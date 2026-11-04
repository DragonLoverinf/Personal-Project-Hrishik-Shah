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

    //True if the mouse (or finger) is on top of the canvas.
    mouseInside(p) {
        return p.mouseX >= 0 && p.mouseX <= p.width && p.mouseY >= 0 && p.mouseY <= p.height;
    }
};