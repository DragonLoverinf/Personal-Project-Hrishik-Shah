//Same code as physics/QTunnel.js, wrapped in a function.
//Change: the example usage is removed.
const QTunnelEngine = (function () {
    //All units are arbitrary, simply segregated by measuring energy, length, and time.
    //Variables
    const particleEnergy = 3.0;
    const barrierHeight = 5.0; //Amount of potential energy in the barrier.
    const barrierWidth = 1.0;  //Width of the barrier.

    //Time-independent schrodinger to get T (probability of tunneling).
    function calculateQuantumProbabilities(E, V0, L) {
        //Natural units to keep math clean.
        const hbar = 1;
        const m = 1;

        let T;

        //Case 1: E is exactly V0.
        //Taking limit as E -> V0 to avoid division by zero crash.
        if (Math.abs(E - V0) < 1e-6) {
            T = 1 / (1 + (m * V0 * L * L) / (2 * hbar * hbar));
        }

        //Case 2: Classically forbidden (E < V0).
        //Wave decays exponentially inside the wall.
        else if (E < V0) {
            const kappa = Math.sqrt(2 * m * (V0 - E)) / hbar;
            const sinhTerm = Math.sinh(kappa * L);

            T = 1 / (1 + (V0 * V0 * sinhTerm * sinhTerm) / (4 * E * (V0 - E)));
        }

        //Case 3: Classically allowed (E > V0).
        //Passes over, but still bounces back a bit (quantum reflection).
        else {
            const k2 = Math.sqrt(2 * m * (E - V0)) / hbar;
            const sinTerm = Math.sin(k2 * L);

            T = 1 / (1 + (V0 * V0 * sinTerm * sinTerm) / (4 * E * (E - V0)));
        }

        return {
            T: T,
            R: 1 - T
        };
    }

    //Assumptions for this setup:
    //Non-relativistic.
    //1D rectangular barrier.
    //No energy outside the barrier (other than particle).
    //Wave function and derivatives are continuous.
    //Only 1, non-complex barrier.

    return { particleEnergy, barrierHeight, barrierWidth, calculateQuantumProbabilities };
})();