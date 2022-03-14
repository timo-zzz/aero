import { scope } from './scope.js';

// Variable emulation
_var = null;
_let = null;
_const = null;

_eval = new Proxy({
    apply(target, that, args) {
        [script] = args;

        script = scope;

        return Reflect.apply(...arguments);
    }
});
window.eval = _eval;

Function = null;