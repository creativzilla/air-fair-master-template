import{H as o,j as e}from"./index-CI1dj2Ng.js";import{i as m,D as l}from"./DynamicFormField-bXsCBVRF.js";/**
 * @license lucide-react v0.427.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const x=o("Lock",[["rect",{width:"18",height:"11",x:"3",y:"11",rx:"2",ry:"2",key:"1w4ew1"}],["path",{d:"M7 11V7a5 5 0 0 1 10 0v4",key:"fwvmzm"}]]);function v({section:i,index:c,values:r,errors:n,onFieldChange:a}){const t=i.fields.filter(s=>m(s,r));return t.length===0?null:e.jsxs("div",{className:"svc-form-section",children:[e.jsxs("div",{className:"svc-form-section-title",children:[e.jsx("span",{className:"svc-form-section-num",children:String(c+1).padStart(2,"0")}),e.jsx("h4",{children:i.title})]}),e.jsx("div",{className:"svc-form-grid",children:t.map(s=>e.jsx(l,{field:s,value:r[s.name],error:n[s.name],onChange:a},s.id))})]})}export{v as F,x as L};
