//p5.js visuals and controls for the N-Body simulation. The physics comes from physics/NBody.js.
const NBodySim = (function () {
    let instance = null;

    const sketch = (p) => {
        //HTML elements the sketch is connected to.
        const holder = document.getElementById("nbody-holder");
        const playBtn = document.getElementById("nbody-play");
        const resetBtn = document.getElementById("nbody-reset");
        const countSlider = document.getElementById("nbody-count");
        const massSlider = document.getElementById("nbody-mass");
        const speedSlider = document.getElementById("nbody-speed");
        const trailsBox = document.getElementById("nbody-trails");
        const energyBox = document.getElementById("nbody-energy");
        const energyPanel = document.getElementById("nbody-energy-box");
        const statusLine = document.getElementById("nbody-status");

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
        let selected = 0;
        let running = false;
        let collided = false;
        let dead = [];
        let blast = null;
        let active = false;
        let ready = false;

        //Dragging state.
        let dragging = null;
        let dragCentre = null;
        let wasRunning = false;

        //Every 4th physics step is added to the trail, and each trail keeps its last 400 points.
        const TRAIL_EVERY = 4;
        const TRAIL_LENGTH = 400;

        //Put everything back to the starting setup for the chosen number of bodies.
        function resetAll() {
            bodies = NBodyEngine.makeBodies(Number(countSlider.value));
            trails = bodies.map(() => []);
            selected = 0;
            dead = [];
            blast = null;
            collided = false;
            dragging = null;
            statusLine.hidden = true;
            setRunning(false);
            showMass();
        }

        //Start or stop the physics, and change the button to match.
        function setRunning(value) {
            running = value;
            playBtn.textContent = running ? "Pause" : "Play";
        }

        //Show the mass of the selected body on the mass slider.
        function showMass() {
            massSlider.value = bodies[selected].mass;
            document.getElementById("nbody-mass-out").textContent = bodies[selected].mass.toFixed(1);
        }

        //Centre of mass, the view follows it.
        function centreOfMass() {
            let mx = 0, my = 0, total = 0;
            for (const b of bodies) {
                mx += b.mass * b.x;
                my += b.mass * b.y;
                total += b.mass;
            }
            return { x: mx / total, y: my / total };
        }

        //World units to pixels, about 4.4 units fit across the canvas.
        function pixelsPerUnit() {
            return Math.min(p.width, p.height) / 4.4;
        }

        //World position to screen position, around a centre point, with y flipped.
        function toScreen(x, y, centre) {
            const s = pixelsPerUnit();
            return { x: p.width / 2 + (x - centre.x) * s, y: p.height / 2 - (y - centre.y) * s };
        }

        //Run the physics for one frame.
        function stepPhysics() {
            //Speed slider is the number of physics steps per frame, times 4.
            const steps = Number(speedSlider.value) * 4;

            for (let s = 0; s < steps; s++) {
                NBodyEngine.verletStep(bodies, NBodyEngine.dt);

                //Check for physical overlaps, if any two bodies crashed the simulation ends.
                const hit = NBodyEngine.checkCollisions(bodies);
                if (hit) {
                    explode(hit[0], hit[1]);
                    return;
                }

                if (s % TRAIL_EVERY === 0) addTrailPoints();
            }
        }

        //Add the current position of every body to its trail, measured from the centre of mass.
        function addTrailPoints() {
            const c = centreOfMass();
            bodies.forEach((b, i) => {
                trails[i].push({ x: b.x - c.x, y: b.y - c.y });
                if (trails[i].length > TRAIL_LENGTH) trails[i].shift();
            });
        }

        //Two bodies crashed, so start the explosion and stop the simulation.
        function explode(i, j) {
            const c = centreOfMass();
            const a = toScreen(bodies[i].x, bodies[i].y, c);
            const b = toScreen(bodies[j].x, bodies[j].y, c);
            const x = (a.x + b.x) / 2;
            const y = (a.y + b.y) / 2;

            const pieces = [];
            for (let k = 0; k < 70; k++) {
                const angle = p.random(p.TWO_PI);
                const speed = p.random(0.5, 5);
                pieces.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed });
            }

            blast = { x, y, age: 0, pieces };
            dead = [i, j];
            collided = true;
            setRunning(false);
            statusLine.textContent = "Collision, simulation stopped";
            statusLine.hidden = false;
        }

        //Find which body is under the mouse, or null if none.
        function bodyAt(mx, my) {
            const c = centreOfMass();
            const s = pixelsPerUnit();
            let best = null;
            let bestDistance = Infinity;
            bodies.forEach((b, i) => {
                const pos = toScreen(b.x, b.y, c);
                const d = Math.hypot(mx - pos.x, my - pos.y);
                //Grab area is at least 16 pixels.
                if (d < Math.max(b.radius * s, 16) && d < bestDistance) {
                    best = i;
                    bestDistance = d;
                }
            });
            return best;
        }

        //Draw the fading trails.
        function drawTrails() {
            p.strokeWeight(1.5);
            trails.forEach((trail, i) => {
                const c = colours[i % colours.length];
                const s = pixelsPerUnit();
                for (let k = 1; k < trail.length; k++) {
                    p.stroke(c[0], c[1], c[2], (k / trail.length) * 170);
                    p.line(
                        p.width / 2 + trail[k - 1].x * s, p.height / 2 - trail[k - 1].y * s,
                        p.width / 2 + trail[k].x * s, p.height / 2 - trail[k].y * s
                    );
                }
            });
        }

        //Draw the explosion, a ring that grows and pieces that fly outwards and fade.
        function drawBlast() {
            blast.age++;
            const fade = Math.max(0, 1 - blast.age / 70);
            const red = colours[0];

            p.noFill();
            p.stroke(red[0], red[1], red[2], 255 * fade);
            p.strokeWeight(3);
            p.circle(blast.x, blast.y, blast.age * 3);

            p.noStroke();
            for (const piece of blast.pieces) {
                piece.x += piece.vx;
                piece.y += piece.vy;
                p.fill(245, 245, 245, 255 * fade);
                p.circle(piece.x, piece.y, 3);
            }
        }

        p.setup = () => {
            p.createCanvas(SimShared.width(holder), SimShared.height(holder));
            resetAll();

            //Buttons.
            playBtn.addEventListener("click", () => {
                if (!collided) setRunning(!running);
            });
            resetBtn.addEventListener("click", resetAll);

            //Sliders and tick boxes.
            countSlider.addEventListener("input", () => {
                document.getElementById("nbody-count-out").textContent = countSlider.value;
                resetAll();
            });
            massSlider.addEventListener("input", () => {
                const mass = Number(massSlider.value);
                bodies[selected].mass = mass;
                bodies[selected].radius = NBodyEngine.radiusFromMass(mass);
                document.getElementById("nbody-mass-out").textContent = mass.toFixed(1);
            });
            speedSlider.addEventListener("input", () => {
                document.getElementById("nbody-speed-out").textContent = speedSlider.value;
            });
            energyBox.addEventListener("change", () => {
                energyPanel.hidden = !energyBox.checked;
            });

            //Catch up if the page was already shown.
            ready = true;
            p.setActive(active);
        };

        p.draw = () => {
            p.background(0);

            if (running) stepPhysics();

            //View follows the centre of mass, except while dragging.
            const centre = dragging !== null ? dragCentre : centreOfMass();
            const s = pixelsPerUnit();

            if (trailsBox.checked) drawTrails();

            //Draw the bodies.
            p.noStroke();
            bodies.forEach((b, i) => {
                if (dead.includes(i)) return;
                const pos = toScreen(b.x, b.y, centre);
                const c = colours[i % colours.length];
                p.fill(c[0], c[1], c[2]);
                p.circle(pos.x, pos.y, Math.max(10, b.radius * s * 2));

                //White ring around the selected body.
                if (i === selected && !collided) {
                    p.noFill();
                    p.stroke(245);
                    p.strokeWeight(1.5);
                    p.circle(pos.x, pos.y, Math.max(10, b.radius * s * 2) + 10);
                    p.noStroke();
                }
            });

            if (blast) drawBlast();

            //Energy numbers, when the tick box is on.
            if (energyBox.checked && !collided) {
                const e = NBodyEngine.computeEnergy(bodies);
                document.getElementById("nbody-ke").textContent = e.kinetic.toFixed(3);
                document.getElementById("nbody-pe").textContent = e.potential.toFixed(3);
                document.getElementById("nbody-te").textContent = e.total.toFixed(3);
            }
        };

        //Mouse or finger goes down, pick up the body under it and pause.
        function pressed() {
            if (!active || collided || !SimShared.mouseInside(p)) return false;

            const hit = bodyAt(p.mouseX, p.mouseY);
            if (hit === null) return false;

            selected = hit;
            showMass();
            dragging = hit;
            dragCentre = centreOfMass();
            wasRunning = running;
            setRunning(false);
            return true;
        }

        //Mouse or finger moves, the grabbed body follows it.
        function moved() {
            if (dragging === null) return true;
            const s = pixelsPerUnit();
            bodies[dragging].x = dragCentre.x + (p.mouseX - p.width / 2) / s;
            bodies[dragging].y = dragCentre.y - (p.mouseY - p.height / 2) / s;
            trails[dragging] = [];
            return false;
        }

        //Mouse or finger lets go, resume if it was running before.
        function released() {
            if (dragging === null) return true;
            dragging = null;
            if (wasRunning) setRunning(true);
            return false;
        }

        p.mousePressed = () => { pressed(); };
        p.mouseDragged = () => { moved(); };
        p.mouseReleased = () => { released(); };

        //Touch screen versions of the above.
        p.touchStarted = () => !pressed();
        p.touchMoved = () => moved();
        p.touchEnded = () => released();

        p.windowResized = () => {
            if (active) p.resizeCanvas(SimShared.width(holder), SimShared.height(holder));
        };

        //Called by main.js when the page is shown or left.
        p.setActive = (value) => {
            active = value;
            if (!ready) return;
            if (value) {
                p.resizeCanvas(SimShared.width(holder), SimShared.height(holder));
                p.loop();
            } else {
                if (dragging !== null) released();
                setRunning(false);
                p.noLoop();
            }
        };
    };

    return {
        start() {
            if (!instance) instance = new p5(sketch, document.getElementById("nbody-holder"));
            instance.setActive(true);
        },
        stop() {
            if (instance) instance.setActive(false);
        }
    };
})();