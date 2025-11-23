import { combineRgb, CompanionFeedbackDefinitions } from '@companion-module/base'
import type { UtahScientificInstance } from './main.js'

export function UpdateFeedbacks(self: UtahScientificInstance): void {
	const feedbacks: CompanionFeedbackDefinitions = {}

	feedbacks['selected_dest'] = {
		type: 'boolean',
		name: 'Selected Destination',
		description: 'Change colour of button on selected destination',
		defaultStyle: {
			color: combineRgb(0, 0, 0),
			bgcolor: combineRgb(102, 255, 102),
		},
		options: [
			{
				type: 'dropdown',
				label: 'Destination',
				id: 'dest',
				default: self.router.destinationNames[0]?.id,
				choices: self.router.destinationNames,
			},
		],
		callback: (feedback) => {
			if (self.router.getSelectedDestination() === feedback.options.dest) {
				return true
			} else {
				return false
			}
		},
	}

	feedbacks['selected_source'] = {
		type: 'boolean',
		name: 'Selected Source',
		description: 'Change colour of button on selected source',
		defaultStyle: {
			color: combineRgb(0, 0, 0),
			bgcolor: combineRgb(102, 255, 255),
		},
		options: [
			{
				type: 'dropdown',
				label: 'Source',
				id: 'source',
				default: self.router.sourceNames[0]?.id,
				choices: self.router.sourceNames,
			},
		],
		callback: (feedback) => {
			if (self.router.getSelectedSource() === feedback.options.source) {
				return true
			} else {
				return false
			}
		},
	}

	feedbacks['source_dest_route'] = {
		type: 'boolean',
		name: 'Source Routed to Destination',
		description: 'Change button colour when this source is routed to selected destination on any level',
		defaultStyle: {
			color: combineRgb(0, 0, 0),
			bgcolor: combineRgb(255, 191, 128),
		},
		options: [
			{
				type: 'dropdown',
				label: 'Source',
				id: 'source',
				default: self.router.sourceNames[0]?.id,
				choices: self.router.sourceNames,
			},
		],
		callback: (feedback) => {
			const statuses = self.router.currentRoutes()
			const selectedDestination = self.router.getSelectedDestination()
			return statuses[selectedDestination - 1] === feedback.options.source
		},
	}

	self.setFeedbackDefinitions(feedbacks)
}
