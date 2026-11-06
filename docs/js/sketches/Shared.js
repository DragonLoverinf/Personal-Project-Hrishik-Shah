//Common things for simulations like canvas size.
const SimShared = {
    //Reads a colour from the css file.
    colour(name) {
        return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    },

    //Turns a hex colour into [r, g, b].
    rgb(hex) {
        const n = parseInt(hex.replace("#", ""), 16);
        return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    },

    //Canvas width is as wide as the box it sits in.
    width(holder) {
        return Math.max(240, Math.floor(holder.clientWidth));
    },

    //Canvas height is limited so the simulation fits on the screen.
    height(holder) {
        return Math.max(220, Math.round(Math.min(holder.clientWidth * 0.75, window.innerHeight * 0.5, 460)));
    },

    //Stand-in for a slider that is not on the page, so the sketch still runs with its normal value.
    stub(value) {
        return { value: value, addEventListener() {} };
    },

    //True if the mouse (or finger) is on top of the canvas.
    mouseInside(p) {
        return p.mouseX >= 0 && p.mouseX <= p.width && p.mouseY >= 0 && p.mouseY <= p.height;
    },

    //Makes the canvas, with the pixel density capped at 1.5 so phones draw fewer pixels.
    start(p, holder) {
        p.pixelDensity(Math.min(window.devicePixelRatio || 1, 1.5));
        p.createCanvas(this.width(holder), this.height(holder));
        p.textFont("IBM Plex Sans, system-ui, sans-serif");
    },

    //Resizes the canvas to fit its box.
    fit(p, holder) {
        p.resizeCanvas(this.width(holder), this.height(holder));
    },

    //Shows and hides the page: show() runs when it opens (and on resize), hide() when it closes.
    //finish() goes at the end of setup(), it catches up if the page was already shown.
    lifecycle(p, show, hide) {
        const life = {
            active: false,
            ready: false,
            finish() { this.ready = true; p.setActive(this.active); }
        };
        p.setActive = (value) => {
            life.active = value;
            if (!life.ready) return;
            if (value) { show(); p.loop(); } else { hide(); p.noLoop(); }
        };
        p.windowResized = () => { if (life.active) show(); };
        return life;
    },

    //Eases a number from 0 to 1, slow at both ends.
    smoothstep(t) {
        t = Math.min(1, Math.max(0, t));
        return t * t * (3 - 2 * t);
    },

    //Soft glowing dot, a faint wide circle behind a solid one. Cheaper than shadowBlur on old devices.
    glow(p, x, y, size, c) {
        p.noStroke();
        p.fill(c[0], c[1], c[2], 28);
        p.circle(x, y, size * 3);
        p.fill(c[0], c[1], c[2], 70);
        p.circle(x, y, size * 1.8);
        p.fill(c[0], c[1], c[2]);
        p.circle(x, y, size);
    },

    //Gives main.js its start() and stop(), the sketch is made the first time the page is shown.
    launch(holderId, sketch) {
        let instance = null;
        return {
            start() {
                if (!instance) instance = new p5(sketch, document.getElementById(holderId));
                instance.setActive(true);
            },
            stop() {
                if (instance) instance.setActive(false);
            }
        };
    }
};