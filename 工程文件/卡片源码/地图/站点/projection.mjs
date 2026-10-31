// Matches NativeCity's adapted camera (yaw 0, pitch 65 degrees, Y down).
export const projection=Object.freeze({id:'native-fixed-65-v2',pitch:65,origin:[0,0]});
const sin=Math.sin(65*Math.PI/180),cos=Math.cos(65*Math.PI/180);
export function project(at,height=0){return[at[0],at[1]*sin-height*cos];}
export function unproject(at){return[at[0],at[1]/sin];}
export function boundsOf(points){const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);return[Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)];}
export function inside(bounds,p){return p[0]>=bounds[0]&&p[0]<=bounds[2]&&p[1]>=bounds[1]&&p[1]<=bounds[3];}
