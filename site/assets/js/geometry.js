/* Original rotating wireframe. Geometry stays mathematical, lightweight, and optional. */
(() => {
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 document.querySelectorAll('canvas[data-geometry]').forEach(canvas=>{
  const ctx=canvas.getContext('2d');if(!ctx)return;
  let width=0,height=0,angle=0,mouseX=0,mouseY=0,visible=true,lastPaint=0;
  const project=(x,y,z)=>{const a=angle+mouseX,b=.58+mouseY;const X=x*Math.cos(a)+z*Math.sin(a),Z=-x*Math.sin(a)+z*Math.cos(a),Y=y*Math.cos(b)-Z*Math.sin(b),depth=y*Math.sin(b)+Z*Math.cos(b);const scale=Math.min(width,height)*.30*4/(4+depth);return[width/2+X*scale,height/2+Y*scale];};
  const line=(points,color)=>{ctx.beginPath();points.forEach((p,i)=>{const q=project(...p);i?ctx.lineTo(...q):ctx.moveTo(...q);});ctx.strokeStyle=color;ctx.lineWidth=.8;ctx.stroke();};
  function draw(){ctx.clearRect(0,0,width,height);
   for(let i=0;i<32;i++){const u=i/32*Math.PI*2,points=[];for(let j=0;j<=70;j++){const v=j/70*Math.PI*2;points.push([(1+.43*Math.cos(v))*Math.cos(u),.43*Math.sin(v),(1+.43*Math.cos(v))*Math.sin(u)]);}line(points,'rgba(166,30,61,.29)');}
   for(let j=0;j<18;j++){const v=j/18*Math.PI*2,points=[];for(let i=0;i<=100;i++){const u=i/100*Math.PI*2;points.push([(1+.43*Math.cos(v))*Math.cos(u),.43*Math.sin(v),(1+.43*Math.cos(v))*Math.sin(u)]);}line(points,'rgba(166,30,61,.35)');}
   const orbit=[];for(let i=0;i<=130;i++){const t=i/130*Math.PI*2;orbit.push([1.9*Math.cos(t),.8*Math.sin(t),.6*Math.sin(t)]);}line(orbit,'rgba(177,105,118,.3)');const p=project(1.9*Math.cos(angle*2),.8*Math.sin(angle*2),.6*Math.sin(angle*2));ctx.beginPath();ctx.arc(...p,4,0,Math.PI*2);ctx.fillStyle='#b3213b';ctx.fill();
  }
  new ResizeObserver(()=>{const r=canvas.getBoundingClientRect(),d=Math.min(devicePixelRatio||1,2);width=r.width;height=r.height;canvas.width=width*d;canvas.height=height*d;ctx.setTransform(d,0,0,d,0,0);draw();}).observe(canvas);
  new IntersectionObserver(entries=>visible=entries[0].isIntersecting).observe(canvas);
  canvas.addEventListener('pointermove',e=>{const r=canvas.getBoundingClientRect();mouseX=(e.clientX-r.left-r.width/2)/r.width*.3;mouseY=(e.clientY-r.top-r.height/2)/r.height*.25;if(reduced.matches)draw();});
  function animate(t){if(visible&&!document.hidden&&!reduced.matches&&t-lastPaint>32){angle+=.003;draw();lastPaint=t;}requestAnimationFrame(animate);}requestAnimationFrame(animate);
 });
})();
