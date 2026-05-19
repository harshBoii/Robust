import type { ChatWorkflowStep, WidgetType } from './types';

export function getStepResumePrompt(step: ChatWorkflowStep): {
  content: string;
  widgetType: WidgetType | null;
} {
  switch (step) {
    case 'mediaSource':
      return {
        content: 'How would you like to add or change your creatives?',
        widgetType: 'mediaSource',
      };
    case 'mediaUpload':
      return {
        content: 'Drop your images and videos here.',
        widgetType: 'mediaUpload',
      };
    case 'mediaPick':
      return {
        content: 'Pick a bulk folder or creatives from your gallery.',
        widgetType: 'mediaPick',
      };
    case 'campaignChoice':
      return {
        content: 'Do you want to use an existing campaign or create a new one?',
        widgetType: 'campaignChoice',
      };
    case 'campaignSelect':
      return {
        content: 'Choose an existing campaign:',
        widgetType: 'campaignPicker',
      };
    case 'pixelSetup':
      return {
        content:
          'Do you have a Meta Pixel ID? Sales and website Leads need one; Traffic, Engagement, and Awareness do not.',
        widgetType: 'pixelQuestion',
      };
    case 'campaignObjective':
      return {
        content: 'Pick a campaign objective:',
        widgetType: 'campaignObjective',
      };
    case 'campaignPreset':
      return {
        content:
          "Let's set up your campaign. Tell me your goal and budget — I'll draft a campaign preset.",
        widgetType: 'campaignPreset',
      };
    case 'campaignApprove':
      return {
        content: 'Review your campaign preset below. Say **approve** or ask for changes.',
        widgetType: 'presetPreview',
      };
    case 'adsetChoice':
      return {
        content: 'Use an existing ad set or create a new one from a preset?',
        widgetType: 'adsetChoice',
      };
    case 'adsetSelect':
      return {
        content: 'Choose an ad set for your ads:',
        widgetType: 'adsetPicker',
      };
    case 'adsetPreset':
      return {
        content:
          'Describe your ad set — budget, schedule, audience, and optimization. I will align it with your campaign.',
        widgetType: 'adsetPreset',
      };
    case 'adsetApprove':
      return {
        content: 'Review your ad set preset below. Say **approve** or ask for changes.',
        widgetType: 'presetPreview',
      };
    case 'creativeMode':
      return {
        content: 'How should we fill in ad copy for each creative group?',
        widgetType: 'creativeMode',
      };
    case 'preview':
      return {
        content: 'Here is your ad preview. Approve or request changes.',
        widgetType: 'adPreview',
      };
    case 'publishChoice':
      return {
        content: 'Ready to publish. Post immediately or schedule for later?',
        widgetType: 'publishSchedule',
      };
    default:
      return { content: 'Continue when you are ready.', widgetType: null };
  }
}
