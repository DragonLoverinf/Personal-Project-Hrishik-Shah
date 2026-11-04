//p5.js visuals and controls for the Electromagnetic Induction simulation. The physics comes from physics/EInduction.js.
const InductionSim = (function () {
    let instance = null;

    const sketch = (p) => {
        //HTML elements the sketch is connected to.
        const holder = document.getElementById("induction-holder");
        const playBtn = document.getElementById("induction-play");
        const resetBtn = document.getElementById("induction-reset");
        const fieldSlider = document.getElementById("induction-field");
        const turnsSlider = document.getElementById("induction-turns");
        const graphBox = document.getElementById("induction-graph");
        const graphNote = document.getElementById("induction-graph-note");
        const emfText = [
            document.getElementById("induction-a"),
            document.getElementById("induction-b"),
            document.getElementById("induction-c")
        ];

        //Colours from the css file, one for each phase.
        const phaseColours = [
            SimShared.rgb(SimShared.colour("--pastel-red")),
            SimShared.rgb(SimShared.colour("--pastel-blue")),
            SimShared.rgb(SimShared.colour("--pastel-purple"))
        ];
        const phaseNames = ["A", "B", "C"];

        //Simulation state.
        let running = false;
        let result = { emf: [0, 0, 0], needleAngle: 0 };
        let leftover = 0;          //Time not yet used by a physics step.
        let simTime = 0;           //Seconds of simulated time.
        let history = [];          //EMF values over time, for the graph.
        let active = false;
        let ready = false;

        //Graph window, the last 4 pi seconds.
        const GRAPH_WINDOW = 4 * Math.PI;

        //Boxes the diagram and the graph are drawn in.
        let diagramBox = { x: 0, y: 0, w: 300, h: 300 };
        let graphBox2 = null;

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
            document.getElementById("induction-field-out").textContent = B.toFixed(1);
            document.getElementById("induction-turns-out").textContent = N;
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

        //Run the physics in fixed steps.
        function stepPhysics() {
            leftover += Math.min(p.deltaTime / 1000, 0.1);
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

        //Draw the three coils around the spinning magnet.
        function drawDiagram(box) {
            const cx = box.x + box.w / 2;
            const cy = box.y + box.h / 2;
            const R = Math.min(box.w, box.h) * 0.36;
            const turns = Number(turnsSlider.value);
            const peak = peakEmf();

            //Ring the coils sit on.
            p.noFill();
            p.stroke(50);
            p.strokeWeight(1);
            p.circle(cx, cy, R * 2);

            //The three coils, brightness follows EMF.
            EInductionEngine.PHASE_OFFSETS.forEach((phi, k) => {
                const c = phaseColours[k];
                const level = Math.min(1, Math.abs(result.emf[k]) / peak);
                const brightness = 70 + 185 * level;
                const coilWidth = R * 0.32;
                const coilHeight = R * 0.46;

                p.push();
                p.translate(cx + R * Math.cos(phi), cy - R * Math.sin(phi));
                p.rotate(-phi);
                p.rectMode(p.CENTER);

                p.fill(14);
                p.stroke(c[0], c[1], c[2], brightness);
                p.strokeWeight(2);
                p.rect(0, 0, coilWidth, coilHeight);

                //One line for every turn of the coil.
                for (let t = 0; t < turns; t++) {
                    const x = -coilWidth / 2 + ((t + 0.5) / turns) * coilWidth;
                    p.line(x, -coilHeight / 2, x, coilHeight / 2);
                }
                p.pop();

                //Phase letter outside the coil.
                p.noStroke();
                p.fill(c[0], c[1], c[2]);
                p.textAlign(p.CENTER, p.CENTER);
                p.textSize(14);
                p.text(phaseNames[k], cx + R * 1.34 * Math.cos(phi), cy - R * 1.34 * Math.sin(phi));
            });

            //The magnet in the middle, light end is north and grey end is south.
            p.push();
            p.translate(cx, cy);
            p.rotate(-result.needleAngle);
            p.rectMode(p.CORNER);
            p.noStroke();
            p.fill(245);
            p.rect(0, -R * 0.11, R * 0.6, R * 0.22);
            p.fill(110);
            p.rect(-R * 0.6, -R * 0.11, R * 0.6, R * 0.22);
            p.pop();
        }

        //Draw the EMF graph, newest values on the right.
        function drawGraph(box) {
            const left = box.x + 18;
            const top = box.y + 28;
            const width = box.w - 36;
            const height = box.h - 56;
            const middle = top + height / 2;
            const peak = peakEmf();

            //Frame, and the zero line in the middle.
            p.noFill();
            p.stroke(50);
            p.strokeWeight(1);
            p.rect(left, top, width, height);
            p.stroke(90);
            p.line(left, middle, left + width, middle);

            //Axis names.
            p.noStroke();
            p.fill(212);
            p.textSize(13);
            p.textAlign(p.LEFT, p.BOTTOM);
            p.text("EMF", left, top - 6);
            p.textAlign(p.RIGHT, p.TOP);
            p.text("Time", left + width, top + height + 6);

            //One line for each phase.
            p.noFill();
            p.strokeWeight(2);
            for (let k = 0; k < 3; k++) {
                const c = phaseColours[k];
                p.stroke(c[0], c[1], c[2]);
                p.beginShape();
                for (const point of history) {
                    const x = left + ((point.t - (simTime - GRAPH_WINDOW)) / GRAPH_WINDOW) * width;
                    const y = middle - (point.emf[k] / peak) * (height / 2) * 0.95;
                    p.vertex(x, y);
                }
                p.endShape();
            }
        }

        p.setup = () => {
            p.createCanvas(SimShared.width(holder), SimShared.height(holder));
            updateFromSliders();
            layout();

            playBtn.addEventListener("click", () => setRunning(!running));
            resetBtn.addEventListener("click", resetAll);
            fieldSlider.addEventListener("input", updateFromSliders);
            turnsSlider.addEventListener("input", updateFromSliders);
            graphBox.addEventListener("change", () => {
                graphNote.hidden = !graphBox.checked;
                layout();
            });

            //Catch up if the page was already shown.
            ready = true;
            p.setActive(active);
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

        p.windowResized = () => {
            if (active) layout();
        };

        //Called by main.js when the page is shown or left.
        p.setActive = (value) => {
            active = value;
            if (!ready) return;
            if (value) {
                layout();
                p.loop();
            } else {
                setRunning(false);
                p.noLoop();
            }
        };
    };

    return {
        start() {
            if (!instance) instance = new p5(sketch, document.getElementById("induction-holder"));
            instance.setActive(true);
        },
        stop() {
            if (instance) instance.setActive(false);
        }
    };
})();