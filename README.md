# 2248 OVERDRIVE

Buildless static game in dist/. Open via HTTP. Competition rules version: overdrive-2.

- Normal mode migrates overdrive2248-v1 without deleting it; legacy numbers convert to BigInt (rounding already present in an old score cannot be recovered).
- Normal saves remain separate from competition. Scores use decimal strings for local/Firestore persistence and BigInt arithmetic.
- Score attack: 60 / 600 seconds. Tile TA: exponent 11 / 20 / 50 / 100, reaching or exceeding qualifies.
- Timer begins at Start; includes animation, dialogs, background time, and reload downtime. A move must be accepted before the deadline. Accepted moves count their full outcome even if animation crosses the deadline. TA stops at accepted move time once that merge produces its target. No hint or undo in competition.
- Bomb collateral subtracts nominal values (rainbow=2); selected tiles do not incur collateral penalties. Bonuses multiply merge gain only; floor score at zero.
- Seeded LCG uint32 streams for dealing and deadlock rescue; visual randomness is independent. Tile number and type each consume one dealing draw. Initial type draws precede initial number draws (kept stable for this version). Refill order is columns left to right, rows top to bottom. Supply value distribution depends on the pre-move maximum; equal seeds alone don't guarantee identical numeric tiles after different moves. Undo restores both streams.
- Histories / personal leaderboards are local-first, import/export JSON. Abandoned runs stay in history, only completions rank. Import and synced results are unverified personal records, not anti-cheat verified public rankings.

## Firebase setup

Project: overdrive-9cc31. Firebase web config is public client configuration, not an administrator credential.

1. Create Firestore **Standard**, **Native mode**, default database `(default)` (not SQL Connect / Cloud SQL). Production mode initially denies client access.
2. Enable Google provider in Authentication. Add `dopagaki-2248.browncrown14.chatgpt.site` to authorized domains.
3. In the game, sign in with Google, open 同期設定, and copy 自分専用ルール. Paste in Firestore Rules and Publish. The generated rules restrict all record access to that single UID.
4. Press 同期する. Records sync under `users/{uid}/records/{recordId}`. Active boards and normal saves stay browser-local. No server credentials, Cloud Functions, Analytics, Storage, or public leaderboard needed.

The client loads Firebase SDK from Google's CDN and restores the Google sign-in session automatically. Cloud errors never discard local records. Firebase project resources / provider / authorized domains / rules cannot be configured by merely supplying firebaseConfig; the owner must complete these console steps. Cross-device Google login and actual Firestore read/write require live account verification.

Tests: `node tests/game.test.cjs`. Browser preview via Sites preview daemon.

## Roguelite (deck version 1)

Select ローグライト in the mode menu. Ten stages, twelve accepted moves per stage. Stage net points must reach `2^(stage+6)` (128 at stage 1, 65,536 at stage 10). Bomb collateral subtracts from stage progress with a floor of zero. Meeting the goal on the last hand wins before the budget check. Stage overflow is not carried into the next quota; board, total score and fever are carried. No time limit, hints or undo.

Initial supply deck: five 2s, four 4s, three 8s. Shuffle without replacement; after every full cycle reshuffle the whole deck. Each numeric draw independently becomes a bomb with 8% initial probability. A rainbow is a deck card and cannot also be a bomb. Deck changes never mutate existing board tiles. Reward acceptance resets the draw pile so the revised deck is effective on the next refill. Deadlock protection is unchanged and may make numbers outside the supply deck.

After stages 1–9: choose one of three seeded, distinct eligible rewards. Add the next largest number; add rainbow; remove/halve/double one chosen numeric card; double all numbers; halve all numbers (2 stays 2); bomb probability -3 or +4 percentage points (0–40%). Target choices group identical cards by value. The numeric exponent cap is 256; minimum deck size four. Reward RNG is independent from refill and rescue RNG, and its offers persist through reload. No new effects beyond the discussed deck/probability controls.

Normal and roguelite saves are held separately. Switching to normal suspends the roguelite; resume via ローグライトの続きへ. Starting a new roguelite abandons the current one. Stage, quota, hands, bag position, deck, reward choices and upgrade log persist locally. Completed/failed run score, max tile and duration enter the existing personal history and Firebase sync using the existing record schema and Rules; full runs are eligible for the personal leaderboard. No new Firestore Rules deployment is required. Stage/deck details are in the local run, not the cloud record.

Tests: `node tests/rogue.test.cjs` covers weighted cycles, bomb isolation, rainbow count, seed replay, upgrade edits, normal/rogue save separation, reward restoration and fail/clear priority.
