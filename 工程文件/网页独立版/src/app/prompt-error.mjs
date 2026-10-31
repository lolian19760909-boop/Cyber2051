export class PromptError extends Error{constructor(code,message,detail){super(message);this.code=code;this.detail=detail;}}
