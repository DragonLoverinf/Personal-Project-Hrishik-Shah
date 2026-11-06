//p5.js visuals and controls for the N-Body simulation. The physics comes from physics/NBody.js.
const NBodySim = SimShared.launch("nbody-holder", (p) => {
    //$ is the shortcut for getElementById from main.js.
    //HTML elements the sketch is connected to.
    const holder = $("nbody-holder");
    const playBtn = $("nbody-play");
    const resetBtn = $("nbody-reset");
    const figureBtn = $("nbody-figure8");
    const countSlider = $("nbody-count");
    const massBox = $("nbody-masses");
    const radiusBox = $("nbody-radii");
    const speedSlider = $("nbody-speed");
    const zoomSlider = $("nbody-zoom") || SimShared.stub(1);
    const trailsBox = $("nbody-trails");
    const energyBox = $("nbody-energy");
    const energyPanel = $("nbody-energy-box");
    const statusLine = $("nbody-status");

    //Colours of the bodies, the first three come from the css file.
    const colours = [
        SimShared.rgb(SimShared.colour("--pastel-red")),
        SimShared.rgb(SimShared.colour("--pastel-blue")),
        SimShared.rgb(SimShared.colour("--pastel-purple")),
        [255, 193, 202],
        [193, 216, 255]
    ];

    //Simulation state.
    let bodies = [];
    let trails = [];
    let running = false;
    let zoom = 1;

    //Times in milliseconds, restartAt is when the system restarts after a crash, washAt is when the white flash of a restart started.
    //Crashes are ignored until graceUntil, so a body let go of close to another is not counted as a crash.
    let blast = null;
    let restartAt = null;
    let washAt = null;
    let graceUntil = 0;

    //The picture stays centred on this point and the zoom is only what the zoom slider says.
    const VIEW = { x: 0, y: 0 };

    //Dragging state, the number of the body being held (or null), and where it is being held.
    let dragging = null;
    let held = { x: 0, y: 0 };

    //Where every body was when Play was pressed, a restart after a crash goes back to this.
    let launch = null;

    //Every 4th physics step is added to the trail, and each trail keeps its last 800 points.
    const TRAIL_EVERY = 4;
    const TRAIL_LENGTH = 800;

    //The trail is drawn in three parts, oldest first: a dotted part that fades in (in 8 steps), a dotted part, then a solid part.
    const FADE_STEPS = 8;

    const life = SimShared.lifecycle(p, () => SimShared.fit(p, holder), () => { dragging = null; setRunning(false); });

    //Put everything back to the starting setup for the chosen number of bodies, the masses and radii stay as they were if keepMasses is true.
    //If restore is true (after a crash) the bodies go back to where they were when Play was pressed, so a layout made by dragging is not lost.
    function resetAll(keepMasses, restore) {
        const old = bodies.map((b) => ({ mass: b.mass, radius: b.radius }));
        const saved = restore ? launch : null;
        launch = saved;
        bodies = NBodyEngine.makeBodies(Number(countSlider.value));
        bodies.forEach((b, i) => {
            if (keepMasses && old[i]) Object.assign(b, old[i]);
            if (saved && saved[i]) Object.assign(b, saved[i]);
        });
        trails = bodies.map(() => []);
        blast = null;
        restartAt = null;
        dragging = null;
        washAt = p.millis();
        statusLine.textContent = saved ? "Restarted from your layout" : bodies.length + "-body system, released from rest";
        statusLine.hidden = false;

        //One mass slider and one radius slider for every body.
        buildSliders(massBox, 0.2, 5, 0.1, "mass", 1);
        buildSliders(radiusBox, 0.03, 0.3, 0.01, "radius", 2);
    }

    //Start or stop the physics, and change the button to match. Pressing Play remembers where every body is, for restarts.
    function setRunning(value) {
        if (value && !running) launch = bodies.map((b) => ({ x: b.x, y: b.y, vx: b.vx, vy: b.vy }));
        running = value;
        playBtn.textContent = running ? "Pause" : "Play";
        if (running) graceUntil = p.millis() + 600;
    }

    //Make one slider for every body in a box, with a dot in the colour of that body. The slider changes b[key] (mass or radius).
    function buildSliders(box, min, max, step, key, digits) {
        if (!box) return;
        box.innerHTML = "";
        bodies.forEach((b, i) => {
            const row = document.createElement("div");
            row.className = "mass-row";
            row.innerHTML = `<span class="mass-dot" style="background:rgb(${colours[i % colours.length]})"></span>` +
                `<input type="range" min="${min}" max="${max}" step="${step}" value="${b[key]}" aria-label="${key} of body ${i + 1}"><output>${b[key].toFixed(digits)}</output>`;
            row.querySelector("input").addEventListener("input", (e) => {
                b[key] = Number(e.target.value);
                row.querySelector("output").textContent = b[key].toFixed(digits);
            });
            box.appendChild(row);
        });
    }

    //World units to pixels, the picture is centred a little below the middle.
    function pixelsPerUnit() {
        return Math.min(p.width, p.height) * 0.16 * zoom;
    }
    function centreY() {
        return p.height * 0.54;
    }

    //World position to screen position, around the fixed centre, with y flipped.
    function toScreen(x, y) {
        const s = pixelsPerUnit();
        return { x: p.width / 2 + (x - VIEW.x) * s, y: centreY() - (y - VIEW.y) * s };
    }

    //How far from the centre a body can get before it counts as escaped, always well past the edge of the picture, so zooming out gives more room.
    function escapeDistance() {
        return Math.max(8, (1.6 * Math.hypot(p.width / 2, p.height)) / pixelsPerUnit());
    }

    //Run the physics for one frame. A body that is being dragged stays where it is, but its gravity still pulls on the others.
    function stepPhysics() {
        //Speed slider is the number of physics steps per frame, times 4.
        const steps = Number(speedSlider.value) * 4;

        for (let s = 0; s < steps; s++) {
            NBodyEngine.verletStep(bodies, NBodyEngine.dt);
            if (dragging !== null) Object.assign(bodies[dragging], { x: held.x, y: held.y, vx: 0, vy: 0 });

            //Check for physical overlaps, if any two bodies crashed there is an explosion and then a restart.
            const hit = p.millis() > graceUntil ? NBodyEngine.checkCollisions(bodies) : null;
            if (hit) {
                explode(hit[0], hit[1]);
                return;
            }

            if (s % TRAIL_EVERY === 0) addTrailPoints();
        }

        //A body that flies very far away restarts the system.
        const escape = escapeDistance();
        if (p.millis() > graceUntil && bodies.some((b) => Math.hypot(b.x - VIEW.x, b.y - VIEW.y) > escape)) restartAt = p.millis() + 150;
    }

    //Add the current position of every body to its trail.
    function addTrailPoints() {
        bodies.forEach((b, i) => {
            trails[i].push({ x: b.x, y: b.y });
            if (trails[i].length > TRAIL_LENGTH) trails[i].shift();
        });
    }

    //Two bodies crashed, so start the explosion and restart a moment later.
    function explode(i, j) {
        const a = toScreen(bodies[i].x, bodies[i].y);
        const b = toScreen(bodies[j].x, bodies[j].y);

        blast = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, age: 0 };
        restartAt = p.millis() + 500;
        statusLine.textContent = "Collision, restarting";
    }

    //Find which body is under the mouse, or null if none.
    function bodyAt(mx, my) {
        const s = pixelsPerUnit();
        let best = null;
        let bestDistance = Infinity;
        bodies.forEach((b, i) => {
            const pos = toScreen(b.x, b.y);
            const d = Math.hypot(mx - pos.x, my - pos.y);
            //Grab area is at least 18 pixels.
            if (d < Math.max(b.radius * s, 18) && d < bestDistance) {
                best = i;
                bestDistance = d;
            }
        });
        return best;
    }

    //Draw one part of a trail, from point from up to point to.
    function trailPart(trail, from, to, c, alpha, dotted) {
        if (to - from < 2) return;
        const s = pixelsPerUnit();
        p.drawingContext.setLineDash(dotted ? [2, 5] : []);
        p.stroke(c[0], c[1], c[2], alpha);
        p.beginShape();
        for (let n = from; n < to; n++) p.vertex(p.width / 2 + (trail[n].x - VIEW.x) * s, centreY() - (trail[n].y - VIEW.y) * s);
        p.endShape();
    }

    //Draw the fading trails.
    function drawTrails() {
        p.noFill();
        p.strokeWeight(1.5);
        trails.forEach((trail, i) => {
            const c = colours[i % colours.length];
            const fadeEnd = Math.floor(trail.length * 0.15);
            const dotEnd = Math.floor(trail.length * 0.45);
            const size = Math.max(1, Math.floor(fadeEnd / FADE_STEPS));

            for (let k = 0; k < FADE_STEPS; k++) {
                trailPart(trail, k * size, Math.min(fadeEnd, (k + 1) * size + 1), c, 8 + (92 * k) / (FADE_STEPS - 1), true);
            }
            trailPart(trail, fadeEnd, dotEnd, c, 115, true);
            trailPart(trail, dotEnd, trail.length, c, 190, false);
        });
        p.drawingContext.setLineDash([]);
    }

    //Draw the explosion, a white flash that grows with a ring around it and fades.
    function drawBlast() {
        blast.age += p.deltaTime;
        const progress = blast.age / 500;
        if (progress >= 1) return;
        const radius = SimShared.smoothstep(progress) * 100;

        p.noStroke();
        p.fill(245, 245, 245, (1 - progress) * 230);
        p.circle(blast.x, blast.y, radius * 2);
        p.noFill();
        p.stroke(245, 245, 245, (1 - progress) * 160);
        p.strokeWeight(2);
        p.circle(blast.x, blast.y, radius * 2.8);
    }

    //Faint white flash over everything when the system restarts.
    function drawWash() {
        const progress = (p.millis() - washAt) / 350;
        if (progress >= 1) {
            washAt = null;
            return;
        }
        p.noStroke();
        p.fill(245, 245, 245, (1 - progress) * 70);
        p.rect(0, 0, p.width, p.height);
    }

    p.setup = () => {
        SimShared.start(p, holder);
        resetAll(false);

        //Buttons.
        playBtn.addEventListener("click", () => setRunning(!running));
        resetBtn.addEventListener("click", () => resetAll(true));
        if (figureBtn) {
            figureBtn.addEventListener("click", () => {
                countSlider.value = 3;
                $("nbody-count-out").textContent = "3";
                resetAll(false);
            });
        }

        //Sliders and tick boxes.
        countSlider.addEventListener("input", () => {
            $("nbody-count-out").textContent = countSlider.value;
            resetAll(true);
        });
        zoomSlider.addEventListener("input", () => {
            $("nbody-zoom-out").textContent = Number(zoomSlider.value).toFixed(2);
        });
        speedSlider.addEventListener("input", () => {
            $("nbody-speed-out").textContent = speedSlider.value;
        });
        energyBox.addEventListener("change", () => {
            energyPanel.hidden = !energyBox.checked;
        });

        life.finish();
    };

    p.draw = () => {
        p.background(0);

        if (restartAt !== null && p.millis() >= restartAt) resetAll(true, true);
        if (running && restartAt === null) stepPhysics();

        //Zoom is exactly the zoom slider.
        zoom = Number(zoomSlider.value);
        const s = pixelsPerUnit();

        if (trailsBox.checked) drawTrails();

        //Draw the bodies.
        p.noStroke();
        bodies.forEach((b, i) => {
            const pos = toScreen(b.x, b.y);
            //Size is the real size of the body at this zoom, so the radius sliders and the zoom both scale it (3 pixels at the smallest).
            const size = Math.max(3, b.radius * s * 2);
            SimShared.glow(p, pos.x, pos.y, size, colours[i % colours.length]);

            //White ring around the body being dragged.
            if (i === dragging) {
                p.noFill();
                p.stroke(245);
                p.strokeWeight(2);
                p.circle(pos.x, pos.y, size + 8);
                p.noStroke();
            }
        });

        if (blast) drawBlast();
        if (washAt !== null) drawWash();

        //Hint at the top while paused.
        if (!running) {
            p.noStroke();
            p.fill(245, 245, 245, 210);
            p.textSize(12);
            p.textAlign(p.CENTER, p.TOP);
            p.text("PAUSED — DRAG A BODY TO REPOSITION IT", p.width / 2, 8);
        }

        //Energy numbers, when the tick box is on, a few times a second.
        if (energyBox.checked && restartAt === null && p.frameCount % 6 === 0) {
            const e = NBodyEngine.computeEnergy(bodies);
            $("nbody-ke").textContent = e.kinetic.toFixed(3);
            $("nbody-pe").textContent = e.potential.toFixed(3);
            $("nbody-te").textContent = e.total.toFixed(3);
        }
    };

    //Mouse or finger goes down, pick up the body under it. The simulation keeps running, so it can be given a shove.
    function pressed() {
        if (!life.active || restartAt !== null || !SimShared.mouseInside(p)) return false;

        const hit = bodyAt(p.mouseX, p.mouseY);
        if (hit === null) return false;

        dragging = hit;
        held = { x: bodies[hit].x, y: bodies[hit].y };
        return true;
    }

    //Mouse or finger moves, the grabbed body follows it and stops moving.
    function moved() {
        if (dragging === null) return true;
        const s = pixelsPerUnit();

        //The body can be taken anywhere on the canvas, but not past its edge.
        const mx = Math.min(p.width, Math.max(0, p.mouseX));
        const my = Math.min(p.height, Math.max(0, p.mouseY));
        held = {
            x: VIEW.x + (mx - p.width / 2) / s,
            y: VIEW.y - (my - centreY()) / s
        };
        Object.assign(bodies[dragging], { x: held.x, y: held.y, vx: 0, vy: 0 });
        trails[dragging] = [];
        return false;
    }

    //Mouse or finger lets go, crashes are ignored for a moment.
    function released() {
        if (dragging === null) return true;
        dragging = null;
        graceUntil = p.millis() + 400;
        return false;
    }

    p.mousePressed = () => { pressed(); };
    p.mouseDragged = () => { moved(); };
    p.mouseReleased = () => { released(); };

    //Touch screen versions of the above.
    p.touchStarted = () => !pressed();
    p.touchMoved = () => moved();
    p.touchEnded = () => released();
});