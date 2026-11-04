//Same code as physics/NBody.js, wrapped in a function.
//Changes: bodies come from makeBodies(n), and the example usage is removed.
const NBodyEngine = (function () {
    //Defining the variables, arbitrary units, other than categorisation, like time or distance.
    const G = 1;
    const dt = 0.004;

    //For Verlet integration.
    //Starting setups for N = 2 to 5.
    const startingSetups = {
        //Two equal masses on a circular orbit.
        2: [
            { x: 1, y: 0, vx: 0, vy: 0.5, mass: 1, radius: 0.07 },
            { x: -1, y: 0, vx: 0, vy: -0.5, mass: 1, radius: 0.07 }
        ],

        //Figure-eight orbit for 3 equal masses.
        3: [
            { x: -0.97000436, y: 0.24308753, vx: 0.466203685, vy: 0.43236573, mass: 1, radius: 0.07 },
            { x: 0.97000436, y: -0.24308753, vx: 0.466203685, vy: 0.43236573, mass: 1, radius: 0.07 },
            { x: 0, y: 0, vx: -0.93240737, vy: -0.86473146, mass: 1, radius: 0.07 }
        ],

        //Equal masses evenly spaced on a ring.
        4: ringSetup(4, 0.978),
        5: ringSetup(5, 1.173)
    };

    //Build n equal masses on a ring, moving sideways at speed v.
    function ringSetup(n, v) {
        const ring = [];
        for (let k = 0; k < n; k++) {
            const angle = (2 * Math.PI * k) / n;
            ring.push({
                x: Math.cos(angle), y: Math.sin(angle),
                vx: -v * Math.sin(angle), vy: v * Math.cos(angle),
                mass: 1, radius: 0.07
            });
        }
        return ring;
    }

    //Give a fresh copy of the setup for n bodies.
    function makeBodies(n) {
        return startingSetups[n].map((b) => ({ ...b }));
    }

    //Radius grows with the cube root of mass.
    function radiusFromMass(mass) {
        return 0.07 * Math.cbrt(mass);
    }

    //Calculate gravitational acceleration for all bodies.
    function computeAcc(bodies) {
        const acc = bodies.map(() => ({ ax: 0, ay: 0 }));

        for (let i = 0; i < bodies.length; i++) {
            for (let j = 0; j < bodies.length; j++) {
                if (i === j) continue;

                const dx = bodies[j].x - bodies[i].x;
                const dy = bodies[j].y - bodies[i].y;

                const d2 = dx * dx + dy * dy;
                const d = Math.sqrt(d2);

                //Newton's law of universal gravitation.
                const f = (G * bodies[j].mass) / (d2 * d);
                acc[i].ax += f * dx;
                acc[i].ay += f * dy;
            }
        }
        return acc;
    }

    //Velocity Verlet integration step.
    function verletStep(bodies, dt) {
        const acc0 = computeAcc(bodies);

        //Update positions based on current velocity and acceleration.
        for (let i = 0; i < bodies.length; i++) {
            bodies[i].x += bodies[i].vx * dt + 0.5 * acc0[i].ax * dt * dt;
            bodies[i].y += bodies[i].vy * dt + 0.5 * acc0[i].ay * dt * dt;
        }

        //Recalculate acceleration at new positions.
        const acc1 = computeAcc(bodies);

        //Update velocities using average of old and new accelerations.
        for (let i = 0; i < bodies.length; i++) {
            bodies[i].vx += 0.5 * (acc0[i].ax + acc1[i].ax) * dt;
            bodies[i].vy += 0.5 * (acc0[i].ay + acc1[i].ay) * dt;
        }
    }

    //Check for physical overlaps between any two bodies.
    //Returns the pair that crashed, or null if none did.
    function checkCollisions(bodies) {
        for (let i = 0; i < bodies.length; i++) {
            for (let j = i + 1; j < bodies.length; j++) {
                const dx = bodies[j].x - bodies[i].x;
                const dy = bodies[j].y - bodies[i].y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                //If distance is less than the sum of their radii, they crashed, hence explosion and the simulation ends.
                if (dist < bodies[i].radius + bodies[j].radius) {
                    return [i, j];
                }
            }
        }
        return null;
    }

    //Calculate total system energy to check stability.
    function computeEnergy(bodies) {
        let KE = 0, PE = 0;

        //Kinetic energy.
        for (const b of bodies) {
            KE += 0.5 * b.mass * (b.vx * b.vx + b.vy * b.vy);
        }

        //Gravitational potential energy.
        for (let i = 0; i < bodies.length; i++) {
            for (let j = i + 1; j < bodies.length; j++) {
                const dx = bodies[j].x - bodies[i].x;
                const dy = bodies[j].y - bodies[i].y;

                //Pure distance used here as well.
                const d = Math.sqrt(dx * dx + dy * dy);
                PE -= (G * bodies[i].mass * bodies[j].mass) / d;
            }
        }

        return {
            kinetic: KE,
            potential: PE,
            total: KE + PE
        };
    }

    //Assumptions for this setup:
    //Newtonian gravity only (no General Relativity).
    //Uses natural units (G=1, dimensionless mass and distance).
    //Velocity Verlet integrator is used for symplectic energy conservation.
    //Bodies have physical radii, and the simulation stops upon collision, removing the need for artificial force softening.
    //Total energy should be negative if the system is gravitationally bound.

    return { G, dt, makeBodies, radiusFromMass, computeAcc, verletStep, checkCollisions, computeEnergy };
})();