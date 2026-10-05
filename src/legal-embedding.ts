// Google EmbeddingGemma, pinned for the competition build. Query and ingestion
// MUST use the same prompt, MRL truncation and normalization version.
export const LEGAL_EMBEDDING_MODEL='@cf/google/embeddinggemma-300m' as const;
export const LEGAL_DIMENSIONS=256;
export const LEGAL_EMBEDDING_VERSION='google-embeddinggemma-300m-mrl256-v1';
export const legalQueryText=(text:string)=>'task: search result | query: '+text.slice(0,400);
export const legalDocumentText=(m:{law:string;article:string;part:number;text:string})=>
  `title: ${m.law} ${m.article}（片段 ${m.part}） | text: ${m.text}`;
export function legalVector(value:unknown):number[]{
  if(!Array.isArray(value)||value.length!==768||value.some(n=>typeof n!=='number'||!Number.isFinite(n)))throw Error('Invalid Google embedding');
  const v=value.slice(0,LEGAL_DIMENSIONS),norm=Math.hypot(...v);
  if(!Number.isFinite(norm)||norm===0)throw Error('Invalid embedding norm');
  return v.map(n=>n/norm);
}
