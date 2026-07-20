import { createFnChannel, registry } from '@mycl/core';

const app = createFnChannel('my-app');
const widgets = createFnChannel('widgets');

// Same identifier path, no collision: different channels, distinct identifiers.
const appGreet = app.capable((): string => 'app base', 'greet');
const widgetGreet = widgets.capable((): string => 'widget base', 'greet');

// ONE registry binding BOTH capabilities: a registry is channel-agnostic.
const overrides = registry()
  .layer(appGreet, () => 'APP OVERRIDE')
  .layer(widgetGreet, () => 'WIDGET OVERRIDE');

// app.mycl installs the registry into the app channel only. The widgetGreet
// binding is IN the active registry, yet the widgets channel never sees it:
// the call fails loud instead of silently dispatching through app's scope.
app.mycl(() => {
  // 'APP OVERRIDE'
  console.log(appGreet());
  try {
    widgetGreet();
  } catch (err) {
    // … "widgets:greet" called outside any registry scope …
    console.log(String(err));
  }
}, overrides)();

// Factories compose across channels: each installs into its own channel.
const widgetPart = widgets.mycl(() => widgetGreet(), overrides);
app.mycl(() => {
  // 'APP OVERRIDE + WIDGET OVERRIDE'
  console.log(`${appGreet()} + ${widgetPart()}`);
}, overrides)();
