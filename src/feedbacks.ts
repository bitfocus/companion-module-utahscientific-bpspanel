import { combineRgb, CompanionFeedbackDefinitions } from '@companion-module/base'
import type { UtahScientificInstance } from './main.js'
import { parseOptionId } from './utils.js'

export function UpdateFeedbacks(self: UtahScientificInstance): void {
	const feedbacks: CompanionFeedbackDefinitions = {}
	const levelChoices = self.api.state.levels

	feedbacks['selected_level'] = {
		type: 'boolean',
		name: 'Selected Level',
		description: 'Change style when the specified levels are selected',
		defaultStyle: {
			color: combineRgb(0, 0, 0),
			bgcolor: combineRgb(153, 102, 255),
		},
		options: [
			{
				type: 'multidropdown',
				label: 'Levels',
				id: 'level',
				default: [],
				choices: levelChoices,
			},
		],
		callback: (feedback) => {
			const feedbackLevels = feedback.options.level as number[]
			if (feedbackLevels.length === 0) return false
			for (const levelId of feedbackLevels) {
				const level = self.api.state.selectedLevels.find((l) => l.id === levelId)
				if (!level || !level.enabled) return false
			}
			return true
		},
	}

	feedbacks['selected_dest'] = {
		type: 'boolean',
		name: 'Selected Destination',
		description: 'Change style of button when destination is selected',
		defaultStyle: {
			color: combineRgb(0, 0, 0),
			bgcolor: combineRgb(102, 255, 102),
		},
		options: [
			{
				type: 'dropdown',
				label: 'Destination',
				id: 'dest',
				default: self.api.state.destinationNames[0]?.id,
				choices: self.api.state.destinationNames,
			},
		],
		callback: (feedback) => {
			const destId = parseOptionId(feedback.options.dest)
			return self.api.state.selectedDestination === destId
		},
	}

	feedbacks['selected_source'] = {
		type: 'boolean',
		name: 'Selected Source',
		description: 'Change style of button when source is selected',
		defaultStyle: {
			color: combineRgb(0, 0, 0),
			bgcolor: combineRgb(102, 255, 255),
		},
		options: [
			{
				type: 'dropdown',
				label: 'Source',
				id: 'source',
				default: self.api.state.sourceNames[0]?.id,
				choices: self.api.state.sourceNames,
			},
		],
		callback: (feedback) => {
			const sourceId = parseOptionId(feedback.options.source)
			return self.api.state.selectedSource === sourceId
		},
	}

	feedbacks['source_dest_route'] = {
		type: 'boolean',
		name: 'Source Routed to Destination',
		description: 'Change style of button when source is routed to selected destination on any selected level',
		defaultStyle: {
			color: combineRgb(0, 0, 0),
			bgcolor: combineRgb(255, 191, 128),
		},
		options: [
			{
				type: 'dropdown',
				label: 'Source',
				id: 'source',
				default: self.api.state.sourceNames[0]?.id,
				choices: self.api.state.sourceNames,
			},
		],
		callback: (feedback) => {
			const selectedDestination = self.api.state.selectedDestination
			if (selectedDestination < 0) return false

			const sourceId = parseOptionId(feedback.options.source)

			return self.api.hasSourceRoutedToDestOnAnySelectedLevel(selectedDestination, sourceId)
		},
	}

	feedbacks['destination_locked'] = {
		type: 'boolean',
		name: 'Destination Locked',
		description: 'Change style when a destination is locked',
		defaultStyle: {
			bgcolor: combineRgb(153, 0, 0),
		},
		options: [
			{
				type: 'dropdown',
				label: 'Destination',
				id: 'dest',
				default: self.api.state.destinationNames[0]?.id,
				choices: self.api.state.destinationNames,
			},
		],
		callback: (feedback) => {
			const destId = parseOptionId(feedback.options.dest)
			const lockState = self.api.state.locks[destId]
			return !!lockState
		},
	}

	self.setFeedbackDefinitions(feedbacks)
}
