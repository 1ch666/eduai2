// Presentation preference, not an authorization or research assignment.
// Existing server rules still own every operation and recorded result.
export function createGuidancePresentation({elements,cancelSpeech}){
 let identity='',generation=0,allowed=false;
 return {
  update(view,mode,owner=''){
   const key=view?JSON.stringify([owner,view.id,view.version,mode]):'';
   const next=!!view&&!(view.investigation&&mode==='challenge'&&!view.completed);
   if(key!==identity){identity=key;generation++;}
   if(allowed&&!next)cancelSpeech();
   allowed=next;
   for(const element of elements)if(element)element.hidden=!allowed;
  },
  get allowed(){return allowed;},
  ticket(){return allowed?generation:null;},
  accepts(ticket){return allowed&&ticket!==null&&ticket===generation;}
 };
}
