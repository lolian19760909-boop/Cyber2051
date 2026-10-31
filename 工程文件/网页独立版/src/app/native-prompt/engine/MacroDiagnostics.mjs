// Derived from SillyTavern 1.19.0 public/scripts/macros/engine/MacroDiagnostics.js; AGPL-3.0. See SOURCE.json and LICENSE.
import {diagnosticConsole as console} from '../host.mjs';
function createMacroRuntimeError({ message, call, def, macroName }) {
    const inferredName = inferMacroName(call, def, macroName);

    const error = new Error(message);
    error.name = 'MacroRuntimeError';
    // @ts-ignore - custom tagging for downstream classification
    error.isMacroRuntimeError = true;
    // @ts-ignore - helpful metadata for debugging
    error.macroName = inferredName;
    // @ts-ignore - best-effort location information
    error.macroRange = call && call.range ? call.range : null;
    // @ts-ignore - attach raw call/definition for convenience
    if (call) error.macroCall = call;
    // @ts-ignore
    if (def) error.macroDefinition = def;

    return error;
}

function logMacroRuntimeWarning({ message, call, def, macroName, error }) {
    const payload = buildMacroPayload({ call, def, macroName, error });
    console.warn('[Macro] Warning:', message, payload);
}

function logMacroInternalError({ message, call, macroName, error }) {
    const payload = buildMacroPayload({ call, def: undefined, macroName, error });
    console.error('[Macro] Error:', message, payload);
}

function logMacroRegisterWarning({ message, macroName, error = undefined }) {
    const payload = buildMacroPayload({ macroName, error });
    console.warn('[Macro] Warning:', message, payload);
}

function logMacroRegisterError({ message, macroName, error = undefined }) {
    const payload = buildMacroPayload({ macroName, error });
    console.error('[Macro] Registration Error:', message, payload);
}

function logMacroGeneralError({ message, error }) {
    console.error('[Macro] Error:', message, error);
}

function logMacroSyntaxWarning({ phase, input, errors }) {
    if (!errors || errors.length === 0) {
        return;
    }

    /** @type {{ message: string, line: number|null, column: number|null, length: number|null }[]} */
    const issues = errors.map((err) => {
        const hasOwnLine = typeof err.line === 'number';
        const hasOwnColumn = typeof err.column === 'number';

        const token = /** @type {{ startLine?: number, startColumn?: number, startOffset?: number, endOffset?: number }|undefined} */ (err.token);

        const line = hasOwnLine ? err.line : (token && typeof token.startLine === 'number' ? token.startLine : null);
        const column = hasOwnColumn ? err.column : (token && typeof token.startColumn === 'number' ? token.startColumn : null);

        /** @type {number|null} */
        let length = null;
        if (typeof err.length === 'number') {
            length = err.length;
        } else if (token && typeof token.startOffset === 'number' && typeof token.endOffset === 'number') {
            length = token.endOffset - token.startOffset + 1;
        }

        return {
            message: err.message,
            line,
            column,
            length,
        };
    });

    const label = phase === 'lexing' ? 'Lexing' : 'Parsing';

    /** @type {Record<string, any>} */
    const payload = {
        phase,
        count: issues.length,
        issues,
        input,
    };

    console.warn('[Macro] Warning:', `${label} errors detected`, payload);
}

function buildMacroPayload({ call, def, macroName, error }) {
    const inferredName = inferMacroName(call, def, macroName);

    /** @type {Record<string, any>} */
    const payload = {
        macroName: inferredName,
    };

    if (call && call.range) payload.range = call.range;
    if (call && typeof call.rawInner === 'string') payload.raw = call.rawInner;
    if (call) payload.call = call;
    if (def) payload.def = def;
    if (error) payload.error = error;

    return payload;
}

function inferMacroName(call, def, explicit) {
    if (typeof explicit === 'string' && explicit.trim()) {
        return explicit.trim();
    }
    if (call && typeof call.name === 'string' && call.name.trim()) {
        return call.name.trim();
    }
    if (def && typeof def.name === 'string' && def.name.trim()) {
        return def.name.trim();
    }
    return 'unknown';
}
export {createMacroRuntimeError,logMacroRuntimeWarning,logMacroInternalError,logMacroRegisterWarning,logMacroRegisterError,logMacroGeneralError,logMacroSyntaxWarning};
