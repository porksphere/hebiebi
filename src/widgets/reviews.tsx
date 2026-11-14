// The Reviews widget (home screen and lock screen): how many reviews are ready, and when more
// arrive. lib/widget.ts feeds it a timeline built from WaniKani's forecast, so it changes on the
// hour without the app running.
//
// The layout runs on its own in the widget, cut off from the app: no hooks, no imports at run
// time, and nothing from outside the function (constants included). Everything it needs comes in
// through props. Named in lower case and marked 'use no memo' so React Compiler leaves it alone.

import { HStack, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
  containerBackground,
  font,
  foregroundStyle,
  lineLimit,
  minimumScaleFactor,
  monospacedDigit,
} from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

export interface ReviewsWidgetProps {
  /** Reviews ready at this point in the timeline. */
  count: number;
  /** The next batch after that: how many, and when ("3 PM"). Empty `nextAt` if none is known. */
  nextCount: number;
  nextAt: string;
}

function reviewsLayout(props: ReviewsWidgetProps, environment: WidgetEnvironment) {
  'widget';
  'use no memo';
  const { count, nextCount, nextAt } = props;
  const family = environment.widgetFamily;
  const noun = count === 1 ? 'review' : 'reviews';
  const later = nextAt ? `+${nextCount} at ${nextAt}` : '';

  if (family === 'accessoryInline') {
    return <Text>{count > 0 ? `${count} ${noun} ready` : nextAt ? `Reviews at ${nextAt}` : 'No reviews'}</Text>;
  }

  if (family === 'accessoryCircular') {
    return (
      <VStack spacing={0} modifiers={[containerBackground({ type: 'hierarchical', style: 'quaternary' }, 'widget')]}>
        <Text modifiers={[font({ size: 22, weight: 'bold' }), monospacedDigit(), minimumScaleFactor(0.5), lineLimit(1)]}>
          {String(count)}
        </Text>
        <Text modifiers={[font({ size: 10, weight: 'semibold', design: 'serif' })]}>復習</Text>
      </VStack>
    );
  }

  if (family === 'accessoryRectangular') {
    return (
      <HStack modifiers={[containerBackground({ type: 'hierarchical', style: 'quaternary' }, 'widget')]}>
        <VStack alignment="leading" spacing={1}>
          <Text modifiers={[font({ size: 12, weight: 'semibold', design: 'serif' })]}>復習</Text>
          <Text modifiers={[font({ size: 20, weight: 'bold' }), monospacedDigit(), lineLimit(1)]}>
            {`${count} ${noun}`}
          </Text>
          <Text modifiers={[font({ size: 12 }), lineLimit(1)]}>
            {later || (count > 0 ? 'ready now' : 'nothing scheduled')}
          </Text>
        </VStack>
        <Spacer />
      </HStack>
    );
  }

  // Home screen. Monochrome like the app: black on white, or white on black.
  const dark = environment.colorScheme === 'dark';
  const ink = dark ? '#FFFFFF' : '#000000';
  const quiet = dark ? '#9A9A9A' : '#6B6B6B';
  return (
    <HStack modifiers={[containerBackground(dark ? '#000000' : '#FFFFFF', 'widget')]}>
      <VStack alignment="leading" spacing={2}>
        <Text modifiers={[font({ size: 15, weight: 'semibold', design: 'serif' }), foregroundStyle(quiet)]}>復習</Text>
        <Spacer />
        <Text
          modifiers={[
            font({ size: 56, weight: 'bold' }),
            monospacedDigit(),
            minimumScaleFactor(0.5),
            lineLimit(1),
            foregroundStyle(ink),
          ]}>
          {String(count)}
        </Text>
        <Text modifiers={[font({ size: 13 }), lineLimit(1), foregroundStyle(quiet)]}>
          {count > 0 ? `${noun} ready` : nextAt ? `next at ${nextAt}` : 'nothing scheduled'}
        </Text>
        {count > 0 && later ? (
          <Text modifiers={[font({ size: 13 }), lineLimit(1), foregroundStyle(quiet)]}>{later}</Text>
        ) : null}
      </VStack>
      <Spacer />
    </HStack>
  );
}

export default createWidget<ReviewsWidgetProps>('Reviews', reviewsLayout, { count: 0, nextCount: 0, nextAt: '' });
