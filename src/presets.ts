import { combineRgb, CompanionPresetDefinitions } from '@companion-module/base'
import { UtahScientificInstance } from './main.js'
export function UpdatePresets(self: UtahScientificInstance): void {
	const presets: CompanionPresetDefinitions = {}
	for (const i of self.router.sourceNames) {
		const srcname = i.label
		const srcid = i.id
		presets[`source_${srcid}`] = {
			category: 'Sources (by name)',
			name: 'Source ' + i,
			type: 'button',
			style: {
				text: srcname, //self.source_names[i].label,
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
								source: srcid,
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
						source: srcid,
					},
					style: {
						color: combineRgb(0, 0, 0),
						bgcolor: combineRgb(102, 255, 255),
					},
				},
				{
					feedbackId: 'source_dest_route',
					options: {
						source: srcid,
					},
					style: {
						color: combineRgb(0, 0, 0),
						bgcolor: combineRgb(255, 191, 128),
					},
				},
			],
		}
	}
	for (const i of self.router.destinationNames) {
		const dstname = i.label
		const dstid = i.id
		presets[`destination_${dstid}`] = {
			category: 'Destinations (by name)',
			name: 'Destination ' + i,
			type: 'button',
			style: {
				text: dstname, //self.source_names[i].label,
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
								dest: dstid,
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
						dest: dstid,
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
