import test from 'node:test';
import assert from 'node:assert/strict';
import {localApiTarget} from './local-api-target.mjs';
test('integration checks accept only explicit loopback HTTP origins',()=>{
  assert.equal(localApiTarget('http://127.0.0.1:8797/'),'http://127.0.0.1:8797');
  assert.equal(localApiTarget('http://localhost:8787'),'http://localhost:8787');
  for(const value of [undefined,'https://localhost','http://example.com','https://civic-law-lab-212.yichengc869.workers.dev',
    'http://localhost.evil.test','http://localhost@evil.test','http://user:secret@localhost:8797',
    'http://localhost:8797/api','http://localhost:8797/?url=evil','http://localhost:8797/#x','file:///tmp/test'])
    assert.throws(()=>localApiTarget(value),String(value));
});
