//Defining the variables.
const Bmax = 1.5; 
const omega = 1.0; 
const N = 4; 
const area = 1.0; 
const dt = 0.016; 

//Phase offsets for 3-phase system (0, 120, and 240 degrees in radians).
const PHASE_OFFSETS = [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3];

//State variables to track over time.
let theta = 0;
let prevFlux = [
    Bmax * area * Math.cos(-PHASE_OFFSETS[0]),
    Bmax * area * Math.cos(-PHASE_OFFSETS[1]),
    Bmax * area * Math.cos(-PHASE_OFFSETS[2])
];

//Calculate EMF for all three phases and the resultant rotating magnetic field vector.
function stepInduction(dt) {
    //Advance the rotor angle based on angular velocity.
    theta += omega * dt;

    let emf = [0, 0, 0];
    let currentFlux = [0, 0, 0];
    let vx = 0;
    let vy = 0;

    for (let k = 0; k < 3; k++) {
        //Calculate magnetic flux through the coil (Phi = B * A * cos(angle)).
        const flux = Bmax * area * Math.cos(theta - PHASE_OFFSETS[k]);
        
        //Calculate rate of change of flux (dPhi/dt) numerically.
        const dPhiDt = (flux - prevFlux[k]) / dt;
        
        //Faraday's law of induction: EMF = -N * (dPhi/dt).
        emf[k] = -N * dPhiDt;
        
        //Store current flux for the next time step.
        currentFlux[k] = flux;

        //Calculate the instantaneous pull of this coil to find the combined rotating field vector.
        const pull = Math.cos(theta - PHASE_OFFSETS[k]);
        vx += pull * Math.cos(PHASE_OFFSETS[k]);
        vy += pull * Math.sin(PHASE_OFFSETS[k]);
    }

    //Update previous flux state.
    prevFlux = currentFlux;

    //Calculate the resultant angle of the combined rotating magnetic field.
    const needleAngle = Math.atan2(vy, vx);

    return {
        emf: emf,
        needleAngle: needleAngle
    };
}

//Assumptions for this setup:
//Faraday's law applies perfectly, ignoring self-inductance and internal resistance of the coils.
//The magnetic field from the central rotor is perfectly uniform.
//Numerical differentiation is used to calculate dPhi/dt across the discrete time step.
//The three coils are perfectly spaced 120 degrees apart in a symmetrical geometry.
//The system is completely linear (ignoring magnetic saturation of any physical iron core).

//Example usage.
const results = stepInduction(dt);
console.log("Phase A EMF (V):", results.emf[0]);
console.log("Phase B EMF (V):", results.emf[1]);
console.log("Phase C EMF (V):", results.emf[2]);
console.log("Resultant Field Angle (rad):", results.needleAngle);