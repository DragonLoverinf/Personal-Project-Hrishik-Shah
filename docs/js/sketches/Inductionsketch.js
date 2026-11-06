//p5.js visuals and controls for the Electromagnetic Induction simulation. The physics comes from physics/EInduction.js.
const InductionSim = SimShared.launch("induction-holder", (p) => {
    //$ is the shortcut for getElementById from main.js.
    //HTML elements the sketch is connected to.
    const holder = $("induction-holder");
    const playBtn = $("induction-play");
    const resetBtn = $("induction-reset");
    const fieldSlider = $("induction-field");
    const turnsSlider = $("induction-turns");
    const speedSlider = $("induction-speed") || SimShared.stub(1);
    const graphBox = $("induction-graph");
    const graphNote = $("induction-graph-note");
    const emfText = [
        $("induction-a"),
        $("induction-b"),
        $("induction-c")
    ];

    //Colours from the css file, one for each phase.
    const phaseColours = [
        SimShared.rgb(SimShared.colour("--pastel-red")),
        SimShared.rgb(SimShared.colour("--pastel-blue")),
        SimShared.rgb(SimShared.colour("--pastel-purple"))
    ];
    const phaseNames = ["A", "B", "C"];

    //Colours of the poles, north is light and south is a grey blue. The key on the page uses the same colours.
    const POLE_COLOURS = { N: [245, 245, 245], S: [160, 175, 200] };

    //Simulation state.
    let running = false;
    let result = { emf: [0, 0, 0], needleAngle: 0 };
    let leftover = 0;          //Time not yet used by a physics step.
    let simTime = 0;           //Seconds of simulated time.
    let history = [];          //EMF values over time, for the graph.
    let focus = -1;            //Phase picked by tapping a coil, -1 for none.

    //Graph window, the last 4 pi seconds.
    const GRAPH_WINDOW = 4 * Math.PI;

    //Boxes the diagram and the graph are drawn in.
    let diagramBox = { x: 0, y: 0, w: 300, h: 300 };
    let graphBox2 = null;

    const life = SimShared.lifecycle(p, layout, () => setRunning(false));

    //Start or stop the physics, and change the button to match.
    function setRunning(value) {
        running = value;
        playBtn.textContent = running ? "Pause" : "Play";
    }

    //Send the slider values to the physics and clear the graph.
    function updateFromSliders() {
        const B = Number(fieldSlider.value);
        const N = Number(turnsSlider.value);
        EInductionEngine.setParameters(B, N);
        $("induction-field-out").textContent = B.toFixed(1);
        $("induction-turns-out").textContent = N;
        history = [];
    }

    //Put the magnet and the graph back to the start.
    function resetAll() {
        EInductionEngine.resetInduction();
        result = { emf: [0, 0, 0], needleAngle: 0 };
        simTime = 0;
        leftover = 0;
        history = [];
        setRunning(false);
    }

    //Size the canvas and split it into the diagram and, if switched on, the graph.
    function layout() {
        const w = SimShared.width(holder);
        const h = SimShared.height(holder);

        if (!graphBox.checked) {
            p.resizeCanvas(w, h);
            diagramBox = { x: 0, y: 0, w: w, h: h };
            graphBox2 = null;
        } else if (w >= 640) {
            //Wide screens: diagram on the left, graph on the right.
            p.resizeCanvas(w, h);
            diagramBox = { x: 0, y: 0, w: w / 2, h: h };
            graphBox2 = { x: w / 2, y: 0, w: w / 2, h: h };
        } else {
            //Narrow screens: graph goes under the diagram.
            const graphHeight = Math.round(h * 0.7);
            p.resizeCanvas(w, h + graphHeight);
            diagramBox = { x: 0, y: 0, w: w, h: h };
            graphBox2 = { x: 0, y: h, w: w, h: graphHeight };
        }
    }

    //Run the physics in fixed steps. The speed slider changes how much time passes every frame.
    function stepPhysics() {
        leftover += Math.min(p.deltaTime / 1000, 0.1) * Number(speedSlider.value);
        while (leftover >= EInductionEngine.dt) {
            result = EInductionEngine.stepInduction(EInductionEngine.dt);
            simTime += EInductionEngine.dt;
            history.push({ t: simTime, emf: result.emf });
            leftover -= EInductionEngine.dt;
        }

        //Remove points older than the graph window.
        while (history.length > 0 && history[0].t < simTime - GRAPH_WINDOW) history.shift();
    }

    //Biggest EMF a phase can reach with the current sliders.
    function peakEmf() {
        return Number(turnsSlider.value) * Number(fieldSlider.value) * EInductionEngine.omega * EInductionEngine.area;
    }

    //Strength of the pole at coil k, 1 is north and -1 is south. The north end of the magnet points towards a south pole.
    function pole(k) {
        return -Math.cos(result.needleAngle - EInductionEngine.PHASE_OFFSETS[k]);
    }

    //Phases that were not picked are dimmed while one is picked.
    function dim(k) {
        return focus < 0 || focus === k ? 1 : 0.3;
    }

    //Where the diagram is centred, and how far from the middle the coils sit.
    function diagramSpot(box) {
        return { cx: box.x + box.w / 2 + 10, cy: box.y + box.h / 2, R: Math.min(box.w, box.h) * 0.3 };
    }

    //Draw one coil, a stack of loops with a square on top. The square shows N or S for the pole at that coil.
    function drawCoil(x, y, angle, k, strength) {
        const c = phaseColours[k];
        const name = strength > 0 ? "N" : "S";
        const pc = POLE_COLOURS[name];
        const loops = Math.min(6, Number(turnsSlider.value));
        const glow = Math.max(0.15, Math.abs(strength));
        const d = dim(k);

        p.push();
        p.translate(x, y);
        p.rotate(angle);
        p.noFill();
        for (let i = 0; i < loops; i++) {
            const offset = (i - (loops - 1) / 2) * 6;
            p.stroke(c[0], c[1], c[2], 30 * glow * d);
            p.strokeWeight(6);
            p.ellipse(offset, 0, 11, 30);
            p.stroke(c[0], c[1], c[2], (100 + 140 * glow) * d);
            p.strokeWeight(2.2);
            p.ellipse(offset, 0, 11, 30);
        }
        p.pop();

        //The square with the pole letter, and the phase letter outside the coil.
        p.fill(pc[0], pc[1], pc[2], (110 + 145 * glow) * d);
        p.stroke(c[0], c[1], c[2], 255 * d);
        p.strokeWeight(1.5);
        p.rect(x - 11, y - 11, 22, 22, 3);
        p.noStroke();
        p.fill(20, 255 * d);
        p.textSize(14);
        p.textStyle(p.BOLD);
        p.textAlign(p.CENTER, p.CENTER);
        p.text(name, x, y + 1);
        p.textStyle(p.NORMAL);
        p.fill(c[0], c[1], c[2], 255 * d);
        p.textSize(13);
        p.text(phaseNames[k], x + Math.cos(angle) * 38, y + Math.sin(angle) * 38);
    }

    //Dashed line with a dot drifting along it, from the magnet tip to the coil pulling on it.
    function drawLink(x1, y1, x2, y2, c) {
        p.drawingContext.setLineDash([3, 5]);
        p.stroke(c[0], c[1], c[2], 140);
        p.strokeWeight(1.2);
        p.line(x1, y1, x2, y2);
        p.drawingContext.setLineDash([]);

        const t = (simTime * 0.9) % 1;
        p.noStroke();
        p.fill(c[0], c[1], c[2], 235);
        p.circle(p.lerp(x2, x1, t), p.lerp(y2, y1, t), 4.5);
    }

    //Draw the magnet needle, the north tip is light with an arrowhead and the south tail is grey. Gives back where the tips are.
    function drawNeedle(cx, cy, angle, length) {
        const dx = Math.cos(angle);
        const dy = -Math.sin(angle);
        const n = POLE_COLOURS.N;
        const s = POLE_COLOURS.S;

        p.push();
        p.translate(cx, cy);
        p.rotate(-angle);
        p.strokeCap(p.ROUND);
        p.strokeWeight(3.2);
        p.stroke(s[0], s[1], s[2]);
        p.line(-length * 0.35, 0, 0, 0);
        p.stroke(n[0], n[1], n[2]);
        p.line(0, 0, length * 0.65, 0);
        p.noStroke();
        p.fill(n[0], n[1], n[2]);
        p.triangle(length * 0.65, 0, length * 0.42, -7, length * 0.42, 7);
        p.fill(s[0], s[1], s[2]);
        p.circle(-length * 0.35, 0, 8);
        p.pop();

        //Dark hub in the middle with a ring around it.
        p.fill(20);
        p.stroke(245);
        p.strokeWeight(1.5);
        p.circle(cx, cy, 12);

        //N and S written beyond the tips, they stay upright.
        p.noStroke();
        p.textSize(11);
        p.fill(n[0], n[1], n[2]);
        p.text("N", cx + dx * (length * 0.65 + 12), cy + dy * (length * 0.65 + 12));
        p.fill(s[0], s[1], s[2]);
        p.text("S", cx - dx * (length * 0.35 + 12), cy - dy * (length * 0.35 + 12));

        return { n: [cx + dx * length * 0.65, cy + dy * length * 0.65], s: [cx - dx * length * 0.35, cy - dy * length * 0.35] };
    }

    //Bar on the left side for the field strength, it fills up as the slider goes up.
    function drawGauge(box) {
        const x = box.x + 14;
        const y = box.y + box.h * 0.2;
        const h = box.h * 0.6;
        const level = (Number(fieldSlider.value) - Number(fieldSlider.min)) / (Number(fieldSlider.max) - Number(fieldSlider.min));
        const c = phaseColours[2];

        p.noFill();
        p.stroke(255, 255, 255, 60);
        p.strokeWeight(1.2);
        p.rect(x, y, 14, h, 3);
        p.noStroke();
        p.fill(c[0], c[1], c[2], 220);
        p.rect(x + 2, y + h - h * level + 2, 10, Math.max(0, h * level - 4), 2);
        p.fill(168);
        p.textSize(10);
        p.textAlign(p.CENTER, p.BOTTOM);
        p.text("FIELD", x + 7, y - 6);
    }

    //Draw the three coils around the spinning magnet, with the pull between them.
    function drawDiagram(box) {
        const { cx, cy, R } = diagramSpot(box);

        drawGauge(box);

        //Ring the coils sit on.
        p.noFill();
        p.stroke(255, 255, 255, 30);
        p.strokeWeight(1.5);
        p.circle(cx, cy, R * 2 + 26);

        //Coil A is at the top, B and C are 120 degrees apart from it.
        const coils = EInductionEngine.PHASE_OFFSETS.map((phi, k) => {
            const angle = -(Math.PI / 2 + phi);
            return { k: k, angle: angle, x: cx + Math.cos(angle) * R, y: cy + Math.sin(angle) * R, strength: pole(k) };
        });
        for (const c of coils) drawCoil(c.x, c.y, c.angle, c.k, c.strength);

        const tips = drawNeedle(cx, cy, result.needleAngle + Math.PI / 2, R * 0.85);

        //Opposite poles attract, the north tip is pulled to the strongest south coil, and the south tail to the strongest north coil.
        let south = coils[0];
        let north = coils[0];
        for (const c of coils) {
            if (c.strength < south.strength) south = c;
            if (c.strength > north.strength) north = c;
        }
        drawLink(tips.n[0], tips.n[1], south.x, south.y, phaseColours[south.k]);
        drawLink(tips.s[0], tips.s[1], north.x, north.y, phaseColours[north.k]);

        //Hint.
        p.noStroke();
        p.fill(168);
        p.textSize(11);
        p.textAlign(p.CENTER, p.BOTTOM);
        p.text("Tap a coil to highlight it, tap the magnet to play or pause", cx, box.y + box.h - 4);
    }

    //Draw the EMF graph, newest values on the right.
    function drawGraph(box) {
        const left = box.x + 12;
        const top = box.y + 12;
        const width = box.w - 24;
        const height = box.h - 24;
        const middle = top + height / 2;
        const peak = peakEmf();

        //Frame, and the zero line in the middle.
        p.fill(10);
        p.stroke(255, 255, 255, 60);
        p.strokeWeight(1.5);
        p.rect(left, top, width, height, 4);
        p.stroke(255, 255, 255, 40);
        p.strokeWeight(1);
        p.line(left, middle, left + width, middle);

        //One line for each phase, with a wide faint line under it for the glow. The picked phase is thicker.
        p.noFill();
        p.strokeJoin(p.ROUND);
        for (let k = 0; k < 3; k++) {
            const c = phaseColours[k];
            for (const pass of [[40, 6], [230, 2]]) {
                p.stroke(c[0], c[1], c[2], pass[0] * dim(k));
                p.strokeWeight(focus === k ? pass[1] + 1.5 : pass[1]);
                p.beginShape();
                for (const point of history) {
                    const x = left + ((point.t - (simTime - GRAPH_WINDOW)) / GRAPH_WINDOW) * width;
                    const y = middle - (point.emf[k] / peak) * (height / 2 - 6);
                    p.vertex(x, y);
                }
                p.endShape();
            }
        }

        //Names of the phases in the corner.
        p.noStroke();
        p.textSize(10);
        p.textAlign(p.LEFT, p.CENTER);
        for (let k = 0; k < 3; k++) {
            const c = phaseColours[k];
            p.fill(c[0], c[1], c[2], 255 * dim(k));
            p.circle(left + 12 + k * 56, top + 12, 7);
            p.fill(212, 255 * dim(k));
            p.text("PHASE " + phaseNames[k], left + 19 + k * 56, top + 12);
        }
    }

    p.setup = () => {
        SimShared.start(p, holder);
        updateFromSliders();
        layout();

        playBtn.addEventListener("click", () => setRunning(!running));
        resetBtn.addEventListener("click", resetAll);
        fieldSlider.addEventListener("input", updateFromSliders);
        turnsSlider.addEventListener("input", updateFromSliders);
        speedSlider.addEventListener("input", () => {
            $("induction-speed-out").textContent = Number(speedSlider.value).toFixed(1);
        });
        graphBox.addEventListener("change", () => {
            graphNote.hidden = !graphBox.checked;
            layout();
        });

        life.finish();
    };

    p.draw = () => {
        p.background(0);

        if (running) stepPhysics();

        drawDiagram(diagramBox);
        if (graphBox2) drawGraph(graphBox2);

        //Numbers for each phase.
        result.emf.forEach((value, k) => {
            emfText[k].textContent = value.toFixed(2);
        });
    };

    //Tap on the magnet plays or pauses, tap on a coil picks its phase (tap it again to let go), tap anywhere else lets go.
    //This uses a click and not a press, so a finger on the canvas can still scroll the page.
    p.mouseClicked = () => {
        if (!life.active || p.mouseX > diagramBox.w || p.mouseY > diagramBox.h) return;
        const { cx, cy, R } = diagramSpot(diagramBox);

        if (Math.hypot(p.mouseX - cx, p.mouseY - cy) < R * 0.5) {
            setRunning(!running);
            return;
        }

        let hit = -1;
        EInductionEngine.PHASE_OFFSETS.forEach((phi, k) => {
            const angle = -(Math.PI / 2 + phi);
            if (Math.hypot(p.mouseX - (cx + Math.cos(angle) * R), p.mouseY - (cy + Math.sin(angle) * R)) < 30) hit = k;
        });
        focus = hit === focus ? -1 : hit;
    };
});