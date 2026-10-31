'use strict';
// Single replacement: prefer scene data; otherwise mount before MVU's saved-reply marker.
// The marker stays intact for the existing music-player regex. Alternative status skins stay unchanged.
const statusPattern = '<ztl>\\s*({[\\s\\S]*?})\\s*<\\/ztl>|(?=<StatusPlaceHolderImpl\\/>)';
// Never consume another update block while searching for an Analysis section.
const bounded = '(?:(?!<\\/?UpdateVariable>)[\\s\\S])';
const analysisPattern = '<UpdateVariable>' + bounded + '*?<(Analysis|Analyze)>(' + bounded + '*?)<\\/\\1>' + bounded + '*?<\\/UpdateVariable>';
module.exports = { statusPattern, analysisPattern };
