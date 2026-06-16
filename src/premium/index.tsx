import React from 'react';

// Compatibility placeholders for the public OpenOffer build.
const NullComponent: React.FC<any> = () => null;

const nullAdCampaigns = (
  _planDetails: { isPremium: boolean; plan?: string; provider?: string },
  _hasProfile: boolean,
  _isAppReady: boolean,
  _appStartTime?: number,
  _lastMeetingEndTime?: number | null,
  _isProcessingMeeting?: boolean,
  _hasLegacyApi?: boolean
) => ({
  activeAd: null as string | null,
  dismissAd: (_campaignId?: string) => {},
  previewAd: (_ad: any) => {},
});

export const PremiumUpgradeModal: React.FC<any> = NullComponent;
export const ProfileVisualizer: React.FC<any> = NullComponent;
export const PremiumPromoToaster: React.FC<any> = NullComponent;
export const ProfileFeatureToaster: React.FC<any> = NullComponent;
export const JDAwarenessToaster: React.FC<any> = NullComponent;
export const RemoteCampaignToaster: React.FC<any> = NullComponent;
export const useAdCampaigns: typeof nullAdCampaigns = nullAdCampaigns;
export const NegotiationCoachingCard: React.FC<any> = NullComponent;
export const NativelyApiPromoToaster: React.FC<any> = NullComponent;
export const MaxUltraUpgradeToaster: React.FC<any> = NullComponent;
export const ModesSettings: React.FC<any> = NullComponent;
