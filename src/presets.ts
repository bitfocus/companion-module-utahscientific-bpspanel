import { combineRgb, CompanionPresetDefinitions } from '@companion-module/base'
import { UtahScientificInstance } from './main.js'
export function UpdatePresets(self: UtahScientificInstance): void {
	const presets: CompanionPresetDefinitions = {}
	for (const i of self.router.state.sourceNames) {
		const sourceName = i.label
		const sourceId = i.id
		presets[`source_${sourceId}`] = {
			category: 'Sources (by name)',
			name: `Source ${sourceName}`,
			type: 'button',
			style: {
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
	for (const i of self.router.state.destinationNames) {
		const destinationName = i.label
		const destinationId = i.id
		presets[`destination_${destinationId}`] = {
			category: 'Destinations (by name)',
			name: `Destination ${destinationName}`,
			type: 'button',
			style: {
				text: '$(bpspanel:destination_' + destinationId + '_name)',
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
			],
		}
	}
	self.setPresetDefinitions(presets)
}
