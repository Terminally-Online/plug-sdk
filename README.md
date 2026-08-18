# @terminallyonline/plug-sdk

React Query SDK for the [Plug](https://plug.to) API — live positions, portfolios,
transactions, and intents for any EVM address, streamed over SSE and validated
with zod.

This repository is auto-synced from the Plug monorepo on every merge; the code
here is exactly what ships to the registry. Issues and PRs are welcome — fixes
land upstream and flow back on the next sync.

## Install

The package is served from the Terminally Online registry. Point the scope at it
once (project `.npmrc`):

```
@terminallyonline:registry=https://git.ca.plug.to/api/packages/terminally-online/npm/
```

```bash
pnpm add @terminallyonline/plug-sdk @tanstack/react-query zod
```

React 18/19, TanStack Query v5, and zod are peer dependencies.

## Quickstart

```tsx
import { PlugSDKProvider, usePositions, useAddress } from "@terminallyonline/plug-sdk/react"

function App() {
	return (
		<PlugSDKProvider>
			<Portfolio address="0xe3c4c1f41bd25606417cb98780d7171801f1e77c" />
		</PlugSDKProvider>
	)
}

function Portfolio({ address }: { address: `0x${string}` }) {
	const positions = usePositions(address)
	const account = useAddress(address, { stream: true })

	if (positions.isLoading) return <span>Loading…</span>
	return (
		<ul>
			{positions.data?.map(p => (
				<li key={p.id}>{p.name}</li>
			))}
		</ul>
	)
}
```

Hooks cover the full API surface: `usePositions`, `useAddress`, `useActivity`,
`useChain`, `useCompile`, `useCreateTransaction`, `useProjection`, and more —
each returning typed, zod-validated data through the shared query cache.

## Conventions worth knowing

- Attribute keys carry unit tags (`"net_worth:money"`, `"net_carry_apy:percent"`).
  `:percent` values are 0..1 fractions — scale ×100 at the display layer.
- Requesting an address adopts it into Plug's index and starts a historical
  backfill; the streamed `address.backfill_percentage` attribute reports
  progress and settles at 100.

## License

MIT
