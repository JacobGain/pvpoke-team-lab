# Security operations

TeamLab is a static, local-first application. Inventory and saved teams remain
in the user's IndexedDB database and are only transferred when the user exports
or imports a local backup file. There are no application API, account, login,
or server-side mutation endpoints to protect.

## Repository and disclosure

- Keep GitHub private vulnerability reporting enabled and security-alert
  notifications active for repository administrators.
- Review the canonical `/.well-known/security.txt` and `/security.txt`
  compatibility copy before their `Expires` date. Production
  validation fails when it is expired, less than 30 days from expiry, or more
  than 366 days from expiry.
- Handle vulnerability details in a private advisory rather than a public issue.
- Keep Dependabot, CodeQL, the lockfile audit, and workflow security validation
  required on release pull requests.

## Cloudflare

- Start with Cloudflare's managed bot settings, allow verified search crawlers,
  and use Managed Challenge for traffic that Cloudflare classifies as likely
  automated. Review Security Events before moving a class of traffic to Block.
- If repeated scraping concentrates on particular paths, add a targeted rate
  limit based on observed human traffic. Avoid a blanket limit across Pokémon
  sprites and battle-data files because normal navigation requests many static
  resources at once.
- Avoid interstitial challenges on JSON and other subresource requests. A
  challenge returns HTML where the application expects data and can break the
  single-page app. Challenge the document request or use pre-clearance when a
  protected API is introduced.
- Keep static asset and battle-data caching enabled. The application versions
  battle-data URLs, so immutable caching avoids repeat transfers without serving
  stale season data after a release.

References:

- [Cloudflare bot protection](https://developers.cloudflare.com/use-cases/solutions/stop-malicious-bots/)
- [Cloudflare rate-limiting guidance](https://developers.cloudflare.com/waf/rate-limiting-rules/best-practices/)
- [Cloudflare Challenge compatibility](https://developers.cloudflare.com/cloudflare-challenges/challenge-types/challenge-pages/)
- [GitHub private vulnerability reporting](https://docs.github.com/en/code-security/how-tos/report-and-fix-vulnerabilities/configure-vulnerability-reporting/configure-for-a-repository)
- [RFC 9116](https://www.rfc-editor.org/rfc/rfc9116.html)
