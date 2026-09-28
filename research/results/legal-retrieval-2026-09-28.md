# Legal retrieval evaluation 2026-09-28

Source commit `5a543a4f4c95bf229d60b769ba6b25abfcdcaf87`; 40 queries (legal-retrieval-v0); corpus full=40818, core=3668 articles.

> draft: queries and gold labels written by an AI assistant on 2026-09-28; every gold chunkId was checked to exist in the law-data snapshot, but relevance judgements are NOT reviewed by a legal expert or teacher.
> dev only. There is no hidden test set yet, so numbers from this file are development numbers and may be optimistic.

| system | corpus | recall@1 | recall@5 | recall@10 | mrr@10 | ndcg@10 | search p50 ms |
|---|---|---|---|---|---|---|---|
| bm25 | full | 0.05 | 0.175 | 0.2 | 0.0983 | 0.1228 | 0.69 |
| bm25 | core | 0.125 | 0.2 | 0.3 | 0.1634 | 0.1944 | 0.08 |
| dense:bge-m3 | core | 0.625 | 0.85 | 0.9 | 0.7254 | 0.7684 | 7.63 |
| hybrid-rrf:bm25+bge-m3 | core | 0.325 | 0.675 | 0.8 | 0.4823 | 0.5589 | 4.56 |
| dense:qwen3-embedding:0.6b | core | 0.475 | 0.85 | 0.9 | 0.6313 | 0.6978 | 7.25 |
| hybrid-rrf:bm25+qwen3-embedding:0.6b | core | 0.275 | 0.575 | 0.775 | 0.4314 | 0.513 | 5.19 |

- bge-m3 (790764642607): dim 1024, corpus embed cached s, float32 storage 14.3 MiB, query embed p50 122.74 ms
- qwen3-embedding:0.6b (ac6da0dfba84): dim 1024, corpus embed 2381.4 s, float32 storage 14.3 MiB, query embed p50 148.45 ms
