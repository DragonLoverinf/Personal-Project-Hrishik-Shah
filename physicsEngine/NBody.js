//Defining the variables, arbitrary units, other than categorisation, like time or distance.
const G = 1; 
const dt = 0.004; 

//For Verlet integration.
//Add more bodies to the array for higher N, base case of 3.
let bodies = [
    { x: 1, y: 0, vx: 0, vy: 0.5, mass: 1, radius: 0.07 },
    { x: -1, y: 0, vx: 0, vy: -0.5, mass: 1, radius: 0.07 },
    { x: 0, y: 1, vx: 0.5, vy: 0, mass: 1.5, radius: 0.08 }
];

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
function checkCollisions(bodies) {
    for (let i = 0; i < bodies.length; i++) {
        for (let j = i + 1; j < bodies.length; j++) {
            const dx = bodies[j].x - bodies[i].x;
            const dy = bodies[j].y - bodies[i].y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            //If distance is less than the sum of their radii, they crashed, hence explosion and the simulation ends.
            if (dist < bodies[i].radius + bodies[j].radius) {
                return true;
            }
        }
    }
    return false;
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

//Example usage.
if (!checkCollisions(bodies)) {
    verletStep(bodies, dt);
    const energy = computeEnergy(bodies);
    console.log("Total Energy:", energy.total);
} else {
    console.log("Collision detected, simulation stopped.");
}