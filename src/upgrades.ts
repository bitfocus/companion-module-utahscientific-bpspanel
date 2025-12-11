import type {
	CompanionUpgradeContext,
	CompanionStaticUpgradeProps,
	CompanionStaticUpgradeResult,
	CompanionStaticUpgradeScript,
} from '@companion-module/base'
import type { ModuleConfig } from './config.js'

export const UpgradeScripts: CompanionStaticUpgradeScript<ModuleConfig>[] = [
	function v3_0_0(_context: CompanionUpgradeContext<ModuleConfig>, props: CompanionStaticUpgradeProps<ModuleConfig>) {
		const changes: CompanionStaticUpgradeResult<ModuleConfig> = {
			updatedConfig: null,
			updatedActions: [],
			updatedFeedbacks: [],
		}

		for (const action of props.actions) {
			if (action.actionId === 'select_source_name') {
				if (action.options.take === undefined) {
					action.options.take = false
					changes.updatedActions.push(action)
				}
			}
		}

		return changes
	},
]
