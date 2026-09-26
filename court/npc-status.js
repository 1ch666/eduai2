const errors={
 RATE_LIMIT:'本網站的 AI 頻率或場次上限已達。',AI_DISABLED:'管理者已停用法庭 AI。',NOT_CONFIGURED:'後端尚未設定 AI 金鑰。',
 QUOTA:'供應商回報 429：額度或頻率限制。',PROVIDER_AUTH:'供應商拒絕授權，請管理者檢查金鑰。',MODEL_NOT_FOUND:'供應商找不到設定的模型。',UPSTREAM:'AI 供應商服務失敗。',
 TIMEOUT:'AI 在 15 秒內未完成回覆。',NETWORK:'連線中斷，未取得完整回覆。',
 RESPONSE_TOO_LARGE:'AI 回傳資料超過安全大小限制。',INVALID_ENCODING:'AI 回覆的文字編碼不正確。',
 ENVELOPE_JSON:'供應商未回傳有效 API JSON。',OUTPUT_TRUNCATED:'模型輸出達到長度限制，回覆被截斷。',EMPTY_CONTENT:'模型沒有傳回回答正文。',
 CONTENT_JSON:'模型有回覆，但不是可解析的 JSON。',CONTENT_SCHEMA:'模型回覆的欄位或引用不符合安全規格。',
 TIMEOUT_OR_FORMAT:'這是舊版保存的逾時／格式失敗紀錄，無法再細分。',
};
export function npcNotice(reply){
 if(reply.errorCode==='DICTIONARY')return '教育部辭典原文；不是本案事實或法律意見。';
 if(reply.mode==='ai')return 'AI 依角色資料回答，仍須核對證物；不是裁判結果。';
 const code=Object.hasOwn(errors,reply.errorCode)?reply.errorCode:'UNKNOWN';
 return `${errors[code]||'AI 未完成回覆。'} [${code}] 未新增角色證詞。`;
}
