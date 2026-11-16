/** Static Pages/Vercel builds only. The Sites worker keeps its own routing. */
export function registerServiceWorker() {
  if(!('serviceWorker' in navigator)||!window.isSecureContext||import.meta.env.DEV)return;
  const register=()=>{void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`,{scope:import.meta.env.BASE_URL}).catch(()=>{/* Exploration also works without offline storage. */});};
  if(document.readyState==='complete')register();
  else window.addEventListener('load',register,{once:true});
}
