<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Project rules
- Method content is DB-driven (`method_pages`, `method_rects`) and always rendered through `src/components/method/A4Page.tsx`; why: one A4 template must present any text (reader, editor, AI output).
- Rectangle/mask coordinates are stored in page percentages; why: overlays must follow the page zoom on any screen.
- Premium status lives on `profiles.is_premium`, changed only by admin, `redeem_activation_code`, or the paid-order trigger; why: users must never self-grant premium.
- Public settings live in `app_settings`, secrets (AI key, Moneroo key) in admin-only `admin_settings`; why: keep keys unreadable by visitors.
- Storage buckets are private; method media uses long-lived signed URLs, premium files are signed at view time; why: workspace blocks public buckets.
- Text-to-speech uses the device voice when it actually starts, else cloud clips (`src/lib/tts.*`, cached in `media/tts/`) played via one tap-unlocked audio element (`src/lib/speech.ts`); why: in-app/WebView browsers have no device voice.
- AI PDF distribution sends ~4.5k-char parts with low reasoning effort and is resumable; why: long AI calls were cut by the network before answering.
- Editor rectangles open settings on double tap detected from react-rnd drag start/stop; why: mobile browsers never fire dblclick on draggable elements.
- Custom pages (`type = "custom"`) store their carousel cards in `method_pages.cards` and render unscaled inside the A4 shell (overlays stay in a scaled layer); why: card HTML must stay readable at device size while rectangle coordinates keep page percentages.
