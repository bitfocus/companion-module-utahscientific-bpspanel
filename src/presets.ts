import { combineRgb, CompanionPresetDefinitions } from '@companion-module/base'
import { UtahScientificInstance } from './main.js'
export function UpdatePresets(self: UtahScientificInstance): void {
	const presets: CompanionPresetDefinitions = {}

	// Level selection presets
	for (const level of self.router.state.levels) {
		presets[`level_${level.id}`] = {
			category: 'Levels',
			name: `Level ${level.id}`,
			type: 'button',
			style: {
				show_topbar: false,
				text: `Level ${level.id}`,
				size: '14',
				color: combineRgb(255, 255, 255),
				bgcolor: combineRgb(0, 0, 0),
			},
			steps: [
				{
					down: [
						{
							actionId: 'toggle_level',
							options: {
								level: [level.id],
							},
						},
					],
					up: [],
				},
			],
			feedbacks: [
				{
					feedbackId: 'selected_level',
					options: {
						level: [level.id],
					},
					style: {
						color: combineRgb(0, 0, 0),
						bgcolor: combineRgb(153, 102, 255),
					},
				},
			],
		}
	}

	for (const i of self.router.state.sourceNames) {
		const sourceName = i.label
		const sourceId = i.id
		presets[`source_${sourceId}`] = {
			category: 'Sources (Select Only)',
			name: `Source ${sourceName}`,
			type: 'button',
			style: {
				show_topbar: false,
				text: '$(bpspanel:source_' + sourceId + '_name)',
				size: '14',
				color: combineRgb(255, 255, 255),
				bgcolor: combineRgb(0, 0, 0),
			},
			steps: [
				{
					down: [
						{
							actionId: 'select_source_name',
							options: {
								source: sourceId,
								take: false,
							},
						},
					],
					up: [],
				},
			],
			feedbacks: [
				{
					feedbackId: 'selected_source',
					options: {
						source: sourceId,
					},
					style: {
						color: combineRgb(0, 0, 0),
						bgcolor: combineRgb(102, 255, 255),
					},
				},
				{
					feedbackId: 'source_dest_route',
					options: {
						source: sourceId,
					},
					style: {
						color: combineRgb(0, 0, 0),
						bgcolor: combineRgb(255, 191, 128),
					},
				},
			],
		}
		presets[`source_${sourceId}_take`] = {
			category: 'Sources (Select & Take)',
			name: `Source ${sourceName} (Take)`,
			type: 'button',
			style: {
				show_topbar: false,
				text: '$(bpspanel:source_' + sourceId + '_name)',
				size: '14',
				color: combineRgb(255, 255, 255),
				bgcolor: combineRgb(0, 0, 0),
			},
			steps: [
				{
					down: [
						{
							actionId: 'select_source_name',
							options: {
								source: sourceId,
								take: true,
							},
						},
					],
					up: [],
				},
			],
			feedbacks: [
				{
					feedbackId: 'selected_source',
					options: {
						source: sourceId,
					},
					style: {
						color: combineRgb(0, 0, 0),
						bgcolor: combineRgb(102, 255, 255),
					},
				},
				{
					feedbackId: 'source_dest_route',
					options: {
						source: sourceId,
					},
					style: {
						color: combineRgb(0, 0, 0),
						bgcolor: combineRgb(255, 191, 128),
					},
				},
			],
		}
	}
	presets[`source_select_take`] = {
		category: 'Sources (Select Only)',
		name: `Take Button`,
		type: 'button',
		style: {
			show_topbar: false,
			text: 'TAKE',
			size: '14',
			color: combineRgb(255, 255, 255),
			bgcolor: combineRgb(0, 0, 0),
		},
		steps: [
			{
				down: [
					{
						actionId: 'take',
						options: {},
					},
				],
				up: [],
			},
		],
		feedbacks: [],
	}
	for (const i of self.router.state.destinationNames) {
		const destinationName = i.label
		const destinationId = i.id
		const destinatonVariable = '$(bpspanel:destination_' + destinationId + '_name)'
		presets[`destination_${destinationId}`] = {
			category: 'Destinations',
			name: `Destination ${destinationName}`,
			type: 'button',
			style: {
				show_topbar: false,
				text: destinatonVariable,
				size: '14',
				color: combineRgb(255, 255, 255),
				bgcolor: combineRgb(0, 0, 0),
			},
			steps: [
				{
					down: [
						{
							actionId: 'select_dest_name',
							options: {
								dest: destinationId,
							},
						},
					],
					up: [],
				},
			],
			feedbacks: [
				{
					feedbackId: 'selected_dest',
					options: {
						dest: destinationId,
					},
					style: {
						color: combineRgb(0, 0, 0),
						bgcolor: combineRgb(102, 255, 102),
					},
				},
				{
					feedbackId: 'destination_locked',
					options: {
						dest: destinationId,
					},
					style: {
						color: combineRgb(0, 0, 0),
						bgcolor: combineRgb(153, 0, 0),
						text: `${destinatonVariable} LOCKED`,
					},
				},
			],
		}
		presets[`lock_destination_${destinationId}`] = {
			category: 'Locks',
			name: `Lock Destination ${destinationName}`,
			type: 'button',
			style: {
				show_topbar: false,
				text: 'LOCK ' + destinatonVariable,
				size: '14',
				color: combineRgb(255, 255, 255),
				bgcolor: combineRgb(0, 0, 0),
			},
			steps: [
				{
					down: [
						{
							actionId: 'set_lock',
							options: {
								destination: destinationId,
								lock: 'toggle',
							},
						},
					],
					up: [],
				},
			],
			feedbacks: [
				{
					feedbackId: 'destination_locked',
					options: {
						dest: destinationId,
					},
					style: {
						color: combineRgb(0, 0, 0),
						bgcolor: combineRgb(153, 0, 0),
						text: `UNLOCK ${destinatonVariable}`,
					},
				},
			],
		}
	}
	self.setPresetDefinitions(presets)
}
