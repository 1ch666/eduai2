// Destructive integration checks must never accept a production origin.
export function localApiTarget(value) {
  const url=new URL(value);
  if(url.protocol!=='http:'||!['127.0.0.1','localhost'].includes(url.hostname)||
    url.username||url.password||url.pathname!=='/'||url.search||url.hash)
    throw new Error('Integration checks require a plain loopback HTTP origin. Production is forbidden.');
  return url.origin;
}
