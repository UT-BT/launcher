# Teams (clans)

The Teams page-view and the team detail page: directory, roles, membership (open joins,
invitations, blocking), clan-tag settings and previews, member numbers, crests, stats, the
activity feed and the audit log. Read it before touching `app/components/pages/teams/` or
`TeamsPage.tsx`.

Elsewhere: how the server composes a tagged alias, directory ranks, owner fields and the crest
URL are in [api.md](../api.md); event teams (`EventTeamPage`) are in [events.md](events.md);
team runs and team caps on team maps are in [api.md](../api.md).

## Where the code lives

| Path | Holds |
|---|---|
| `app/components/pages/TeamsPage.tsx`, `TeamsPage.types.ts` | the `teams` page-view: my-team and invitations cache, gallery, Create Team modal; the types file keeps state and cache defaults out of the lazy page |
| `app/components/pages/teams/TeamDetailsPage.tsx` | the `team-detail` entry: loads the team and `/me/team`, derives the viewer's role, owns Join / Accept / Decline |
| `teams/TeamHeaderCard.tsx` | owner actions (edit modal, crest, transfer, delete), Leave, the per-member tag toggle |
| `teams/MembersPanel.tsx` | roster plus the manager modals: Requests, Member numbers, Manage members, Audit log |
| `teams/TeamGallery.tsx`, `TeamCard.tsx`, `TeamMetricRow.tsx` | directory search, filter and sort; cards with metric rows and rank chips |
| `teams/TeamStatsRow.tsx`, `TeamActivityPanel.tsx`, `TeamWorldRecordsPanel.tsx` | detail-page stat tiles, activity table, world-records table; each fetches for itself |
| `teams/CreateTeamForm.tsx`, `TagStyleFields.tsx` | create form; tag style, position and spacing controls and `TagPreview` |
| `teams/tagFormat.ts`, `teamStats.ts` | pure: validation mirrors of the server rules, `formatTaggedAlias` for previews, stat sorts and hour formatting; Vitest in the sibling `.test.ts` files |
| `teams/teamsShared.tsx` | team helpers (`teamErrorMessage`, `refreshUserProfile`, crest limits) and a form/section kit other features import (see [Shared beyond Teams](#shared-beyond-teams)) |
| `teams/PlayerSearchInput.tsx` | the app-wide player picker ([shared-components.md](../shared-components.md)) |
| `app/utils/api.ts` | every team type (`TeamCore`, `TeamDetail`, `TeamMember`, …) and fetcher; grep `/teams/` or `/me/team` |

## Pages and navigation

- **`teams`** is a lazy, controlled page-view. Per-entry state (`utbt:teamsState:v2`, no
  preference fields): search, access filter, sort field, sort direction, scroll. Its `caches`
  hold `myTeam` (from `/me/team`) and `invitations` (from `/me/invitations`), revalidated on
  every mount through `load(background)`.
- **The directory list is not cached.** `TeamGallery` keeps the rows in its own state and
  refetches the whole directory (`fetchTeams` with `limit: 0`) on every visit and on each
  search (350 ms debounce), access filter or sort change. Default sort: World Records,
  descending.
- **`team-detail`** (`/teams/<id>`) is keyed per entry. Its `onExitToGallery` is
  `exitTeamsToGallery` in `Main.tsx`: it marks the teams cache unloaded and navigates to
  `teams`, so the gallery refetches `myTeam`. The detail page calls it after Leave, Delete,
  Join, Accept and Decline.
- Detail-page tables keep their sort and page per entry with `useNavState` keys suffixed by
  the team id: `team-activity-sort-<id>`, `team-wr-sort-<id>`, `team-wr-page-<id>`.
- **Signed out** (web) both pages browse with `accessToken ?? ''`; Create Team and Join call
  `requestLogin`; invitations and every personal control are hidden. Anonymous browsing:
  [web-target.md](../web-target.md).

## Roles and permissions

The viewer's team is the one `/me/team` returns. On that team's page the viewer's role is
their `TeamMember.role`; on any other team it is `none`. The UI calls `admin` "Moderator".

| Action | Owner | Moderator (`admin`) | Member | No team |
|---|---|---|---|---|
| Edit name, tag, style, access; crest; transfer; delete | yes | | | |
| Promote to moderator / demote | yes | | | |
| Kick, Kick & block | any non-owner | members only | | |
| Invite, cancel invite, unblock, member numbers, audit log | yes | yes | | |
| Leave | | yes | yes | |
| Toggle own clan tag | yes | yes | yes | |
| Join an open team / accept an invite | | | | yes |

- The client gating only decides what to show; the server enforces each rule and its
  message surfaces through `teamErrorMessage` into an `ErrorBanner`.
- The owner cannot leave: they transfer or delete. `transferTeamOwnership` makes the chosen
  active member owner and the old owner a moderator; Transfer shows only when another active
  member exists. `setTeamMemberRole` takes `admin` or `member` only.
- A manager header button appears only when it has work: Requests when anything is pending,
  Member numbers when the tag style is not `plain`, Manage members when someone is
  manageable. Audit log is always there for managers.

## Membership

- **One team per player.** `/me/team` returns one team or `{ team: null }`. Join and Accept
  stay disabled, with a "Leave your current team…" tooltip, while the viewer has a team.
- **`TeamMember.status`** is `active`, `invited` or `blocked`, and `TeamDetail.members`
  carries all three. Rosters, member counts and stats use `active`; the managers' Requests
  modal lists `invited` and `blocked`.
- **Open teams** (`is_open`) are joined directly: `joinTeam` (`POST /teams/<id>/join`). There
  is no application or approval step.
- **Invite-only teams** grow by invitation. A manager picks a player in `PlayerSearchInput`
  (every current `members` row is excluded, whatever its status) and calls `inviteToTeam`. The
  player sees it in "Your Invitations" on the Teams page and as Accept / Decline on the team
  page. A manager withdraws an invite with `denyTeamMember`.
- **Blocking**: `kickTeamMember(…, true)` kicks and leaves a `blocked` row; that player sees
  "Blocked from joining" instead of Join. `unblockTeamMember` (from Requests) removes it.
- **Mutations return the fresh `TeamDetail`** (leave, disband and the lineup calls excepted).
  Replace the page's team with it through `onTeamChange`; never patch members locally.
- **Refresh the viewer's own profile after anything that changes the name they wear.** The
  profile alias carries the clan tag, so the sidebar card and Home go stale otherwise.
  `refreshUserProfile()` dispatches `refresh-user-profile` and `app.tsx` refetches the
  profile. Create, Accept from the Teams page, Leave, Delete, Edit and the tag toggle call it;
  the team page's Join and Accept do not.

## Clan tags, styles and numbers

The server applies the tag to every alias it returns ([api.md](../api.md) has the rule). This
section covers editing it.

- A team has `tag`, `tag_style` (`plain` / `numbered` / `number_only`), `tag_position`
  (`prefix` / `suffix`, hidden in the form for `number_only`) and `tag_spaced`.
  `TagStyleFields` edits them and `TagPreview` renders the result through `PlayerInfo`.
- **A tag is required** on create and edit (the submit stays disabled without one), although
  the API types allow `tag: null`.
- **Preview from the raw alias.** `TagPreview` composes from the `alias` it is given, so pass
  the untagged one: the edit modal passes the owner's `TeamMember.raw_alias` and
  `tag_number`; the create form may pass `userProfile.alias` only because the creator has no
  team yet. `userProfile.alias` of a team member is already tagged and would render the tag
  twice. A numbered style with no assigned number previews with `1` and says so.
- **Validation mirrors the server.** `tagFormat.ts` holds the team-name, tag and
  member-number rules so errors show inline; the server stays the authority. Change both
  sides together; `tagFormat.test.ts` pins accepted and rejected examples (`!` and `#` are
  allowed in tags, a `<Cxx>` in-game colour code is not).
- **Member numbers** exist only when the style is not `plain`. Managers set them in the
  Member numbers modal: one input per active member, committed on blur or Enter, empty clears
  (`null`); the server keeps numbers unique within the team. Each row's key includes
  `tag_number`, so a successful save remounts the row and a failed one keeps the typed draft
  for correction.
- **Per-member opt-out.** Any active member toggles "Show clan tag on my name"
  (`setMyTagHidden`, `PATCH /me/team` with `{ tag_hidden }`, returns the fresh team). The API
  then returns that member untagged everywhere; the roster marks them with an eye-off icon.

## Crests

- The owner uploads, replaces or removes the crest from the header card (`uploadTeamAvatar`,
  multipart field `file`; `deleteTeamAvatar`). Both return the fresh team, whose
  `avatar_updated` busts the cached image.
- `teamsShared.tsx` mirrors the server's limits (`TEAM_AVATAR_MAX_BYTES`,
  `TEAM_AVATAR_ACCEPT`, `teamAvatarValidationError`) so a bad file fails before the upload.
  The create form validates; the header card only filters by the file input's `accept`.
- **Create then upload.** The crest endpoint needs a team id, so `CreateTeamForm` creates the
  team, then uploads. If the upload fails it holds the created team: Retry upload never
  re-creates it and "Continue without image" proceeds to the team.
- Preview a picked file as a `data:` URL (`readImageDataUrl`), not `createObjectURL`: the
  renderer CSP allows `data:` in `img-src` but not `blob:`.

## Directory, stats and activity

- The directory row contract (stats, directory-wide ranks, zero totals, owner fields) is in
  [api.md](../api.md). Sorting the gallery by a stat highlights that metric row on every card;
  the viewer's own team card is tinted and marked "Yours".
- **Team numbers belong to the current active members.** Totals are summed over them, and
  the world-records table asks `fetchWorldRecords({ users })` with their ids (8 per page,
  sorted and paged by the server, with `fetchWorldRecordsCount`). A player's records leave
  with them.
- The detail stat tiles read `fetchTeamActivity(limit: 1)` (totals, ranks, `ranked_teams`),
  not the directory row; `TeamActivityPanel` calls the same endpoint with `limit: 15` for the
  feed. Both, and the world-records table, skip the request when the team has no active
  member.
- Show a rank chip only when the metric total is above zero (`TeamMetricRow`,
  `TeamStatsRow`).
- Activity rows are `cap`, `world_record` or `playtime`. The feed is the 15 newest; its
  column sort is client-side over those rows. The viewer's own rows are highlighted.

## Audit log

Managers open it from the Members header; `fetchTeamAudit(limit: 100)` loads when the modal
opens and again when `team.members` changes. `AUDIT_META` in `MembersPanel.tsx` turns each
`action` into an icon and a sentence. It keeps `apply`, `withdraw`, `approve` and `deny`
because older rows carry them, and it handles `number` and `avatar`, which `TeamAuditAction`
in `api.ts` does not list. An unknown action renders as `actor · action`; when the server adds
one, add its row to `AUDIT_META`.

## Lineups

`TeamDetail.lineups`, the lineup fetchers and `LineupsPanel.tsx` (named sets of 2–12 active
members) exist, but no page mounts the panel: lineups have no UI. Deleting a team deletes its
lineups.

## Shared beyond Teams

`teamsShared.tsx` doubles as a form kit: `ErrorBanner`, `SectionCard`, `teamInputClass` and
`StatusBadge` are imported across `app/components/pages/events/` (manage, schedule,
predictions, sign-up) and by `EventDetailPage` and `EventsPage`; `PlayerSearchInput` by
Admin, event sign-up and the Stream tab. A change to any of them restyles those pages, so
check them too.
