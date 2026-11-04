//p5.js visuals and controls for the Quantum Tunnelling simulation. T and R come from physics/QTunnel.js.
const TunnelSim = (function () {
    let instance = null;

    const sketch = (p) => {
        //HTML elements the sketch is connected to.
        const holder = document.getElementById("tunnel-holder");
        const energySlider = document.getElementById("tunnel-energy");
        const heightSlider = document.getElementById("tunnel-height");
        const widthSlider = document.getElementById("tunnel-width");
        const resultLine = document.getElementById("tunnel-result");
        const fireBtn = document.getElementById("tunnel-fire");
        const fireManyBtn = document.getElementById("tunnel-fire-many");
        const resetBtn = document.getElementById("tunnel-reset");
        const passedText = document.getElementById("tunnel-passed");
        const bouncedText = document.getElementById("tunnel-bounced");

        //Colours from the css file.
        const blue = SimShared.rgb(SimShared.colour("--pastel-blue"));
        const red = SimShared.rgb(SimShared.colour("--pastel-red"));
        const purple = SimShared.rgb(SimShared.colour("--pastel-purple"));

        //Slider values and the result for them.
        let E = 3, V0 = 5, L = 1;
        let result = { T: 0, R: 1 };

        //Wave packet picture.
        const PACKET_SPREAD = 1.0;     //Width of the packet in world units.
        const PACKET_SPEED = 2.0;      //How fast the packet moves, in world units per second.
        const START_X = -6.5;          //Where the packet centre starts.
        let time = 0;                  //Seconds since the packet started.

        //Fired particles.
        let dots = [];
        let queued = 0;
        let nextLaunch = 0;
        let passed = 0;
        let bounced = 0;

        let active = false;
        let ready = false;

        //World units to pixels, 14 units fit across the canvas and x = 0 is the middle.
        function pixelsPerUnit() { return p.width / 14; }

        //Height of the wave picture, the rest of the canvas is the particle strip.
        function waveHeight() { return p.height * 0.68; }

        //Energy to a y pixel in the wave picture, 0 is at the bottom and 10 near the top.
        function energyToY(value) {
            const top = 50;
            const bottom = waveHeight() - 14;
            return bottom - (value / 10) * (bottom - top);
        }

        //Read the sliders, work out T and R, and restart the packet.
        function updateFromSliders() {
            E = Number(energySlider.value);
            V0 = Number(heightSlider.value);
            L = Number(widthSlider.value);
            result = QTunnelEngine.calculateQuantumProbabilities(E, V0, L);

            document.getElementById("tunnel-energy-out").textContent = E.toFixed(1);
            document.getElementById("tunnel-height-out").textContent = V0.toFixed(1);
            document.getElementById("tunnel-width-out").textContent = L.toFixed(1);
            resultLine.textContent = "T = " + result.T.toFixed(4) + ", R = " + result.R.toFixed(4);

            time = 0;
        }

        //Bell-shaped envelope of the packet, 1 at its centre.
        function envelope(x, centre) {
            const d = (x - centre) / PACKET_SPREAD;
            return Math.exp(-d * d);
        }

        //Value of the wave at world position x, at the current time.
        function waveAt(x) {
            const k = Math.sqrt(2 * E);          //Wave number.
            const omega = E;                      //Angular frequency.
            const barrierStart = -L / 2;
            const barrierEnd = L / 2;
            const centre = START_X + PACKET_SPEED * time;

            //Before the barrier: the incoming packet plus the reflected packet, with height sqrt(R).
            if (x < barrierStart) {
                const mirrorCentre = 2 * barrierStart - centre;
                return envelope(x, centre) * Math.cos(k * x - omega * time)
                    + Math.sqrt(result.R) * envelope(x, mirrorCentre) * Math.cos(-k * x - omega * time);
            }

            //Inside the barrier: the height shrinks from 1 to sqrt(T).
            const insideK = E > V0 ? Math.sqrt(2 * (E - V0)) : 0;
            const shrink = Math.pow(Math.sqrt(result.T), Math.min(x - barrierStart, L) / L);

            if (x <= barrierEnd) {
                return shrink * envelope(x, centre) * Math.cos(insideK * (x - barrierStart) + k * barrierStart - omega * time);
            }

            //After the barrier: the packet that got through, with height sqrt(T).
            return Math.sqrt(result.T) * envelope(x, centre)
                * Math.cos(k * (x - barrierEnd) + insideK * L + k * barrierStart - omega * time);
        }

        //Draw the barrier, the energy line, and the wave.
        function drawWave() {
            const s = pixelsPerUnit();
            const mid = p.width / 2;
            const bottom = waveHeight() - 14;
            const yE = energyToY(E);
            const yV = energyToY(V0);

            //Barrier.
            p.fill(14);
            p.stroke(purple[0], purple[1], purple[2]);
            p.strokeWeight(2);
            p.rect(mid - (L / 2) * s, yV, L * s, bottom - yV);

            //Ground line.
            p.stroke(60);
            p.strokeWeight(1);
            p.line(0, bottom, p.width, bottom);

            //Energy line of the particle.
            p.stroke(120);
            p.line(0, yE, p.width, yE);

            //The wave, drawn around the energy line.
            const amplitude = 28;
            p.noFill();
            p.stroke(blue[0], blue[1], blue[2]);
            p.strokeWeight(2);
            p.beginShape();
            for (let px = 0; px <= p.width; px += 2) {
                const x = (px - mid) / s;
                p.vertex(px, yE - amplitude * waveAt(x));
            }
            p.endShape();
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
                through: false
            });
        }

        //Move and draw every dot, and decide pass or bounce when it reaches the barrier.
        function drawDots() {
            const s = pixelsPerUnit();
            const mid = p.width / 2;
            const stripTop = waveHeight() + 8;
            const speed = 260 * (p.deltaTime / 1000);

            //Barrier and strip border.
            p.fill(14);
            p.stroke(purple[0], purple[1], purple[2]);
            p.strokeWeight(2);
            p.rect(mid - (L / 2) * s, stripTop, L * s, p.height - stripTop - 8);

            //Release the queued particles, one every 40 milliseconds.
            if (queued > 0 && p.millis() >= nextLaunch) {
                launchDot();
                queued--;
                nextLaunch = p.millis() + 40;
            }

            p.noStroke();
            for (const d of dots) {
                d.x += speed * d.direction;

                //At the front of the barrier the particle either goes through or bounces, using T.
                if (!d.decided && d.x >= mid - (L / 2) * s) {
                    d.decided = true;
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

                const c = !d.decided ? [245, 245, 245] : (d.through ? blue : red);
                p.fill(c[0], c[1], c[2]);
                p.circle(d.x, d.y, 7);
            }

            dots = dots.filter((d) => d.x > -10 && d.x < p.width + 10);
        }

        p.setup = () => {
            p.createCanvas(SimShared.width(holder), SimShared.height(holder));
            updateFromSliders();

            for (const slider of [energySlider, heightSlider, widthSlider]) {
                slider.addEventListener("input", updateFromSliders);
            }

            fireBtn.addEventListener("click", () => { queued += 1; });
            fireManyBtn.addEventListener("click", () => { queued += 100; });
            resetBtn.addEventListener("click", () => {
                dots = [];
                queued = 0;
                passed = 0;
                bounced = 0;
                passedText.textContent = "0";
                bouncedText.textContent = "0";
                time = 0;
            });

            //Catch up if the page was already shown.
            ready = true;
            p.setActive(active);
        };

        p.draw = () => {
            p.background(0);

            //Move the packet along and restart it at the right edge.
            time += p.deltaTime / 1000;
            if (START_X + PACKET_SPEED * time > 10) time = 0;

            drawWave();
            drawDots();
        };

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
                p.noLoop();
            }
        };
    };

    return {
        start() {
            if (!instance) instance = new p5(sketch, document.getElementById("tunnel-holder"));
            instance.setActive(true);
        },
        stop() {
            if (instance) instance.setActive(false);
        }
    };
})();