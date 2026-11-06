//p5.js visuals and controls for the Quantum Tunnelling simulation. T and R come from physics/QTunnel.js.
const TunnelSim = SimShared.launch("tunnel-holder", (p) => {
    //$ is the shortcut for getElementById from main.js.
    //HTML elements the sketch is connected to.
    const holder = $("tunnel-holder");
    const energySlider = $("tunnel-energy");
    const heightSlider = $("tunnel-height");
    const widthSlider = $("tunnel-width");
    const speedSlider = $("tunnel-speed") || SimShared.stub(1);
    const fireBtn = $("tunnel-fire");
    const fireManyBtn = $("tunnel-fire-many");
    const resetBtn = $("tunnel-reset");
    const passedText = $("tunnel-passed");
    const bouncedText = $("tunnel-bounced");

    //Colours from the css file, the wall is pastel purple with a darker purple edge.
    const blue = SimShared.rgb(SimShared.colour("--pastel-blue"));
    const red = SimShared.rgb(SimShared.colour("--pastel-red"));
    const purple = SimShared.rgb(SimShared.colour("--pastel-purple"));
    const darkPurple = purple.map((v) => Math.round(v * 0.5));
    const white = [245, 245, 245];

    //Slider values and the result for them.
    let E = 3, V0 = 5, L = 1;
    let result = { T: 0, R: 1 };

    //Wave packet picture, all sizes are in pixels and grow with the canvas width (700 pixels wide is the normal size).
    const CREST_SPEED = 85;        //How fast the crests slide along the packet, in pixels per second.
    const FLASH = 0.5;             //Seconds the white ring at the wall takes to fade, the packet does not wait for it.
    const DOT_HOLD = 0.3;          //Seconds a particle waits at the wall while its collision plays.
    const SPLIT = 0.6;             //Seconds the packet takes to split into the bounced and the transmitted part, it starts the moment it hits the wall.
    const FADE_IN = 0.6;           //Seconds a new packet takes to fade in.
    const FADE_OUT = 0.25;         //Seconds the old packet takes to fade out when a slider is moved.
    let run = {};                  //Numbers for the packet that is on its way, set by startRun().
    let wall = { x1: 0, x2: 0 };   //Where the wall is drawn, it slides to the new size when a slider is moved.
    let pending = null;            //Time (in milliseconds) a new packet is wanted, set by the sliders so it waits until they stop moving.
    let elapsed = 0;               //Seconds since the page was shown.
    const xs = new Float32Array(256);  //Points of the curve being drawn, reused for every curve.
    const ys = new Float32Array(256);

    //Fired particles.
    let dots = [];
    let queued = 0;
    let nextLaunch = 0;
    let passed = 0;
    let bounced = 0;

    const life = SimShared.lifecycle(p, () => { SimShared.fit(p, holder); startRun(true); }, () => {});

    //Speed slider, how fast time runs for the packet and the particles.
    function timeScale() { return Number(speedSlider.value); }

    //Height of the wave picture, the rest of the canvas is the particle strip.
    function waveHeight() { return p.height * 0.68; }

    //Height of the middle of the wave picture, and the tallest the wave gets.
    function midY() { return waveHeight() * 0.54; }
    function maxAmplitude() { return Math.min(46, waveHeight() * 0.15); }

    //Writes text into an element, if the page has it.
    function show(id, text) {
        const el = $(id);
        if (el) el.textContent = text;
    }

    //Read the sliders, work out T and R, show them as percentages, and restart the packet.
    function updateFromSliders() {
        E = Number(energySlider.value);
        V0 = Number(heightSlider.value);
        L = Number(widthSlider.value);
        result = QTunnelEngine.calculateQuantumProbabilities(E, V0, L);

        show("tunnel-energy-out", E.toFixed(1));
        show("tunnel-height-out", V0.toFixed(1));
        show("tunnel-width-out", L.toFixed(1));
        show("tunnel-t-value", (result.T * 100).toFixed(2) + "%");
        show("tunnel-r-value", (result.R * 100).toFixed(2) + "%");
        show("tunnel-regime", E < V0 ? "Tunnelling regime (E < V₀)" : "Over-barrier regime (E > V₀), watch it wobble");
        show("tunnel-result", "T = " + result.T.toFixed(4) + ", R = " + result.R.toFixed(4));
        if ($("tunnel-t-fill")) $("tunnel-t-fill").style.width = result.T * 100 + "%";
        if ($("tunnel-r-fill")) $("tunnel-r-fill").style.width = result.R * 100 + "%";

        //The packet restarts a moment after the sliders stop moving.
        pending = p.millis() + 160;
    }

    //Send a new packet in from the left. Higher energy means faster and more crests. If snap is true the wall jumps to its new size.
    function startRun(snap) {
        const u = p.width / 700;
        const level = Math.min(1, Math.max(0, (E - 0.5) / 9));
        const barrierWidth = Math.max(18, L * 60 * u);

        run = {
            u: u,
            T: result.T,
            R: result.R,
            E: E,
            V0: V0,
            k: (0.16 + 0.14 * level) / u,        //Crests per pixel.
            speed: (90 + 130 * level) * u,       //Pixels per second.
            sigma: 62 * u,                       //Width of the packet.
            step: 5 * u,                         //Gap between points of the curve.
            x1: p.width / 2 - barrierWidth / 2,
            x2: p.width / 2 + barrierWidth / 2,
            xc: p.width * 0.05,                  //Where the packet centre is.
            start: elapsed,
            flash: null,                         //When the packet reached the wall.
            split: 0,                            //How far the packet has split, 0 to 1.
            out: null                            //When the packet started to fade out, if it is being replaced.
        };
        if (snap) wall = { x1: run.x1, x2: run.x2 };
        pending = null;

        //The packet starts as a flat line and bends into a wave as it comes, finishing when it reaches the wall.
        const travelTime = Math.max(60 * u, run.x1 - run.xc) / run.speed;
        run.revealSpeed = (run.sigma * 2.6 * 2) / Math.max(0.4, travelTime);
    }

    //Fill xs and ys with the points of a packet centred at cx, and give back how many. It is a sine wave inside a bell shape.
    function packetPoints(cx, amp, phase, revealFront) {
        let n = 0;
        for (let dx = -run.sigma * 2.6; dx <= run.sigma * 2.6 && n < xs.length; dx += run.step) {
            const x = cx + dx;
            const bell = Math.exp(-(dx * dx) / (2 * run.sigma * run.sigma));

            //Left of the reveal front the packet is still a flat line.
            const reveal = revealFront === null ? 1 : SimShared.smoothstep((x - revealFront) / (run.sigma * 0.8) + 0.5);
            xs[n] = x;
            ys[n] = midY() + Math.sin(x * run.k + phase) * bell * reveal * amp;
            n++;
        }
        return n;
    }

    //Draw the first n points as one smooth curve. Everything on the wave picture fades with run.fade.
    function strokeCurve(n, c, alpha, weight) {
        p.noFill();
        p.stroke(c[0], c[1], c[2], alpha * run.fade);
        p.strokeWeight(weight);
        p.beginShape();
        for (let i = 0; i < n; i++) p.splineVertex(xs[i], ys[i]);
        p.endShape();
    }

    //Draw one packet, moving right (direction 1) or left (direction -1).
    function drawPacket(cx, amp, c, direction, revealFront) {
        const phase = -direction * run.k * CREST_SPEED * run.u * elapsed;

        //A faint copy trails behind it.
        strokeCurve(packetPoints(cx - direction * 20 * run.u, amp * 0.85, phase, revealFront), c, 55, 2);

        //A wide faint line under a bright one makes the glow.
        const n = packetPoints(cx, amp, phase, revealFront);
        strokeCurve(n, c, 40, 8);
        strokeCurve(n, c, 235, 2.8);
    }

    //The part of the wave inside the wall, it fades away quickly. Only when the energy is below the wall. Strength is 0 to 1.
    function drawInside(strength) {
        if (run.E >= run.V0 || strength < 0.02) return;
        const kappa = Math.sqrt(2 * (run.V0 - run.E));
        const phase = -run.k * CREST_SPEED * run.u * elapsed;
        let n = 0;
        for (let x = run.x1; x <= run.x2 && n < xs.length; x += run.step) {
            xs[n] = x;
            ys[n] = midY() + Math.sin(x * run.k + phase) * Math.exp((-kappa * (x - run.x1) * 1.6) / (60 * run.u)) * maxAmplitude() * 0.7;
            n++;
        }
        strokeCurve(n, white, 130 * strength, 1.8);
    }

    //A white ring and flash at the wall, size is how far the ring grows.
    function drawImpact(x, y, progress, size) {
        if (progress >= 1) return;
        p.noFill();
        p.stroke(245, 245, 245, (1 - progress) * 150);
        p.strokeWeight(2);
        p.circle(x, y, SimShared.smoothstep(progress) * size * 2);
        p.noStroke();
        p.fill(245, 245, 245, Math.pow(1 - progress, 3) * 200);
        p.circle(x, y, size * 0.3 * (1 - progress) + 6);
    }

    //The wall, pastel purple with a darker purple edge and two darker lines in the middle.
    function drawWall(top, bottom) {
        const third = (wall.x2 - wall.x1) / 3;
        p.fill(purple[0], purple[1], purple[2]);
        p.stroke(darkPurple[0], darkPurple[1], darkPurple[2]);
        p.strokeWeight(3);
        p.rect(wall.x1, top, wall.x2 - wall.x1, bottom - top, 4);
        p.strokeWeight(1.5);
        p.line(wall.x1 + third, top + 4, wall.x1 + third, bottom - 4);
        p.line(wall.x1 + 2 * third, top + 4, wall.x1 + 2 * third, bottom - 4);
    }

    //Moves the packet along. The moment it hits the wall the ring flashes and it starts to split, over SPLIT seconds, while it carries on.
    function movePacket(dt) {
        run.xc += run.speed * dt;
        if (run.flash === null && run.xc >= run.x1) {
            run.xc = run.x1;
            run.flash = elapsed;
        }
        if (run.flash !== null) run.split = Math.min(1, run.split + dt / SPLIT);
    }

    //Draw the wall and the packets. The incoming packet (white) shrinks as it splits, the packets that bounce (blue) and get through (red) grow.
    function drawWave() {
        const top = waveHeight() * 0.14;
        const bottom = waveHeight() * 0.86;
        drawWall(top, bottom);

        p.noStroke();
        p.fill(245, 245, 245, 230);
        p.textSize(10);
        p.textAlign(p.CENTER, p.BOTTOM);
        p.text("BARRIER", (wall.x1 + wall.x2) / 2, top - 6);

        //Whole picture fades in when a packet starts, and out when a slider is moved. Packets also fade as they get very small, so none pops in.
        const base = Math.min(
            SimShared.smoothstep((elapsed - run.start) / FADE_IN),
            run.out === null ? 1 : 1 - SimShared.smoothstep((elapsed - run.out) / FADE_OUT)
        );
        const eased = SimShared.smoothstep(run.split);
        const amp = maxAmplitude();
        const mirrorX = 2 * run.x1 - run.xc;
        const revealWidth = Math.min(run.sigma * 2.6 * 2, run.revealSpeed * (elapsed - run.start));

        p.strokeJoin(p.ROUND);
        p.strokeCap(p.ROUND);
        const parts = [
            [run.xc, amp * (1 - eased), white, 1, run.x1 - revealWidth],
            [run.xc, amp * Math.sqrt(run.T) * eased, red, 1, null],
            [mirrorX, amp * Math.sqrt(run.R) * eased, blue, -1, null]
        ];
        for (const part of parts) {
            if (part[1] < 0.05) continue;
            run.fade = base * Math.min(1, part[1] / 3);
            drawPacket(part[0], part[1], part[2], part[3], part[4]);
        }

        //The wave inside the wall appears with the collision and fades as the packet splits.
        run.fade = base;
        if (run.flash !== null) {
            drawInside((1 - eased) * SimShared.smoothstep((elapsed - run.flash) / 0.15));
            drawImpact(run.x1, midY(), (elapsed - run.flash) / FLASH, 70);
        }
    }

    //Start one dot from the left side of the particle strip.
    function launchDot() {
        const stripTop = waveHeight() + 8;
        const stripHeight = p.height - stripTop - 8;
        dots.push({
            x: 0,
            y: stripTop + stripHeight * p.random(0.15, 0.85),
            direction: 1,
            decided: false,
            through: false,
            wait: 0
        });
    }

    //A dot that has finished its collision with the wall either goes through or bounces, using T.
    function decide(d) {
        d.through = p.random() < result.T;
        if (d.through) {
            passed++;
            passedText.textContent = passed;
        } else {
            bounced++;
            bouncedText.textContent = bounced;
            d.direction = -1;
        }
    }

    //Move and draw every dot. At the wall it stops, the collision plays, and then it goes through or bounces.
    function drawDots(dt) {
        const stripTop = waveHeight() + 8;
        const step = 260 * dt;

        drawWall(stripTop, p.height - 8);

        //Release the queued particles, one every 40 milliseconds.
        if (queued > 0 && p.millis() >= nextLaunch) {
            launchDot();
            queued--;
            nextLaunch = p.millis() + 40;
        }

        //Dots that left the picture are dropped as the loop goes, so no new list is made every frame.
        let kept = 0;
        for (const d of dots) {
            if (d.wait > 0) {
                d.wait -= dt;
                drawImpact(wall.x1, d.y, 1 - d.wait / DOT_HOLD, 16);
                if (d.wait <= 0) decide(d);
            } else {
                d.x += step * d.direction;
                if (!d.decided && d.x >= wall.x1) {
                    d.x = wall.x1;
                    d.decided = true;
                    d.wait = DOT_HOLD;
                }
            }
            if (d.x < -10 || d.x > p.width + 10) continue;
            dots[kept++] = d;

            const c = d.wait > 0 || !d.decided ? white : (d.through ? red : blue);
            p.noStroke();
            p.fill(c[0], c[1], c[2]);
            p.circle(d.x, d.y, 7);
        }

        dots.length = kept;
    }

    p.setup = () => {
        SimShared.start(p, holder);
        updateFromSliders();
        startRun(true);

        for (const slider of [energySlider, heightSlider, widthSlider]) {
            slider.addEventListener("input", updateFromSliders);
        }
        speedSlider.addEventListener("input", () => {
            show("tunnel-speed-out", timeScale().toFixed(1));
        });

        fireBtn.addEventListener("click", () => { queued += 1; });
        fireManyBtn.addEventListener("click", () => { queued += 100; });
        resetBtn.addEventListener("click", () => {
            dots = [];
            queued = 0;
            passed = 0;
            bounced = 0;
            passedText.textContent = "0";
            bouncedText.textContent = "0";
            pending = p.millis();
        });

        life.finish();
    };

    p.draw = () => {
        const dt = (Math.min(p.deltaTime, 50) / 1000) * timeScale();
        p.background(0);

        //Move the packet along, and send a new one once both halves have left.
        elapsed += dt;
        movePacket(dt);
        if (run.xc > p.width + run.sigma * 2 && 2 * run.x1 - run.xc < -run.sigma * 2) startRun();

        //A slider was moved, the packet fades out and then a new one starts. The wall slides to its new size.
        if (pending !== null && p.millis() >= pending && run.out === null) run.out = elapsed;
        if (run.out !== null && elapsed - run.out >= FADE_OUT) startRun();
        const slide = 1 - Math.exp(-p.deltaTime / 80);
        wall.x1 += (run.x1 - wall.x1) * slide;
        wall.x2 += (run.x2 - wall.x2) * slide;

        drawWave();
        drawDots(dt);
    };
});