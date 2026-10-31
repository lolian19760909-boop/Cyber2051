// Derived from SillyTavern 1.19.0 public/scripts/variables.js; AGPL-3.0. See SOURCE.json and LICENSE.
import {convertValueType} from './utils.mjs';
export function createVarStore(initial={}, {onChange}={}){
 let chat_metadata={variables:structuredClone(initial)};
 const saveMetadataDebounced=()=>onChange?.(structuredClone(chat_metadata.variables));
function getLocalVariable(name, args = {}) {
    if (!chat_metadata.variables) {
        chat_metadata.variables = {};
    }

    let localVariable = chat_metadata?.variables[args.key ?? name];
    if (args.index !== undefined) {
        try {
            localVariable = JSON.parse(localVariable);
            const numIndex = Number(args.index);
            if (Number.isNaN(numIndex)) {
                localVariable = localVariable[args.index];
            } else {
                localVariable = localVariable[Number(args.index)];
            }
            if (typeof localVariable == 'object') {
                localVariable = JSON.stringify(localVariable);
            }
        } catch {
            // that didn't work
        }
    }

    return (localVariable?.trim?.() === '' || isNaN(Number(localVariable))) ? (localVariable || '') : Number(localVariable);
}

function setLocalVariable(name, value, args = {}) {
    if (!name) {
        throw new Error('Variable name cannot be empty or undefined.');
    }

    if (!chat_metadata.variables) {
        chat_metadata.variables = {};
    }

    if (args.index !== undefined) {
        try {
            let localVariable = JSON.parse(chat_metadata.variables[name] ?? 'null');
            const numIndex = Number(args.index);
            if (Number.isNaN(numIndex)) {
                if (localVariable === null) {
                    localVariable = {};
                }
                localVariable[args.index] = convertValueType(value, args.as);
            } else {
                if (localVariable === null) {
                    localVariable = [];
                }
                localVariable[numIndex] = convertValueType(value, args.as);
            }
            chat_metadata.variables[name] = JSON.stringify(localVariable);
        } catch {
            // that didn't work
        }
    } else {
        chat_metadata.variables[name] = value;
    }
    saveMetadataDebounced();
    return value;
}

function addLocalVariable(name, value) {
    const currentValue = getLocalVariable(name) || 0;
    try {
        const parsedValue = JSON.parse(currentValue);
        if (Array.isArray(parsedValue)) {
            parsedValue.push(value);
            setLocalVariable(name, JSON.stringify(parsedValue));
            return parsedValue;
        }
    } catch {
        // ignore non-array values
    }
    const increment = Number(value);

    if (isNaN(increment) || isNaN(Number(currentValue))) {
        const stringValue = String(currentValue || '') + value;
        setLocalVariable(name, stringValue);
        return stringValue;
    }

    const newValue = Number(currentValue) + increment;

    if (isNaN(newValue)) {
        return '';
    }

    setLocalVariable(name, newValue);
    return newValue;
}

function incrementLocalVariable(name) {
    return addLocalVariable(name, 1);
}

function decrementLocalVariable(name) {
    return addLocalVariable(name, -1);
}

function existsLocalVariable(name) {
    return chat_metadata.variables && chat_metadata.variables[name] !== undefined;
}

function deleteLocalVariable(name) {
    if (!existsLocalVariable(name)) {
        console.warn(`The local variable "${name}" does not exist.`);
        return '';
    }

    delete chat_metadata.variables[name];
    saveMetadataDebounced();
    return '';
}
 return {get:getLocalVariable,set:setLocalVariable,add:addLocalVariable,inc:incrementLocalVariable,dec:decrementLocalVariable,has:existsLocalVariable,del:deleteLocalVariable,delete:deleteLocalVariable,snapshot:()=>structuredClone(chat_metadata.variables),restore(value={}){chat_metadata.variables=structuredClone(value);return this;},clear(){chat_metadata.variables={};saveMetadataDebounced();},reset(value={}){this.restore(value);saveMetadataDebounced();return this;}};
}
