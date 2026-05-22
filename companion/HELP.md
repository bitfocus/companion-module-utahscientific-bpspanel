## Utah Scientific BPS Panel

This module allows you to connect to [Utah Scientific](https://utahscientific.com) routers and controllers that support the RCP3 protocol.

### Configuration

- Enter the device's IP address
- The default port is **5001**. Leave this as-is unless you have changed this value on the device.
- Enter the number of levels you would like to route.

### Actions

- Select Source / Destination: This allows for panel-style routing, with am option for "Take on Select", or to use the separate Take action for extra confirmation
- Route Source to Destination: one step action, with the ability to choose between all levels or a chosen subset
- Set Lock: toggle, lock, or unlock destinations
- Toggle / Select / Deselect Levels: Ability to choose specific levels when using the panel-style routing setup

### Feedbacks

- Selected Source / Destination: highlights selected values; will clear on take
- Selected Levels: highlights which levels are selected to be routed
- Source Routed to Destination: active when source is routed to selected destination on any selected level
- Destination Locked: shows when a destination has an active lock

### Variables

- source\_#_name: Source label assigned by the router or controller
- destination\_#_name: Destination label assigned by the router or controller
- destination\_#_source_name: Current source name (level 1 only) for each destination
- destination\_#_source_id: Current source (level 1 only) for each destination
- destination\_#_lock_state: Current lock state of each destination
- route\_#_level#: Active source on each level of each destination
