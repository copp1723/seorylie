import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { onboardingAPI } from '../services/onboarding';
import { OnboardingInput } from '../schemas/validation';

export const useOnboardingStatus = () => {
  return useQuery({
    queryKey: ['onboarding', 'status'],
    queryFn: onboardingAPI.getStatus,
  });
};

export const useSubmitOnboarding = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: OnboardingInput) => onboardingAPI.submit(data),
    onSuccess: () => {
      // Invalidate onboarding status
      queryClient.invalidateQueries({ queryKey: ['onboarding', 'status'] });
      // Also invalidate user profile as onboarding completion may affect it
      queryClient.invalidateQueries({ queryKey: ['auth', 'profile'] });
    },
  });
};

export const useSaveOnboardingDraft = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ step, data }: { step: number; data: Partial<OnboardingInput> }) => 
      onboardingAPI.saveDraft(step, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onboarding', 'status'] });
    },
  });
};

export const useIndustries = () => {
  return useQuery({
    queryKey: ['onboarding', 'industries'],
    queryFn: onboardingAPI.getIndustries,
    staleTime: Infinity, // This data doesn't change often
  });
};

export const useBusinessTypes = () => {
  return useQuery({
    queryKey: ['onboarding', 'business-types'],
    queryFn: onboardingAPI.getBusinessTypes,
    staleTime: Infinity,
  });
};

export const useValidateWebsite = () => {
  return useMutation({
    mutationFn: (url: string) => onboardingAPI.validateWebsite(url),
  });
};

export const useAnalyzeCompetitors = () => {
  return useMutation({
    mutationFn: (urls: string[]) => onboardingAPI.analyzeCompetitors(urls),
  });
};

export const useGetKeywordSuggestions = () => {
  return useMutation({
    mutationFn: ({ businessType, industry }: { businessType: string; industry: string }) => 
      onboardingAPI.getKeywordSuggestions(businessType, industry),
  });
};