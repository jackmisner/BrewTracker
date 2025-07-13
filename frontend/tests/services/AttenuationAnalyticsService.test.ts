import attenuationAnalyticsService from '../../src/services/Analytics/AttenuationAnalyticsService';
import ApiService from '../../src/services/api';
import { AttenuationAnalytics } from '../../src/types';

// Mock the API service
jest.mock('../../src/services/api', () => ({
  __esModule: true,
  default: {
    attenuationAnalytics: {
      getYeastAnalytics: jest.fn(),
      getAllYeastAnalytics: jest.fn(),
      getImprovedEstimate: jest.fn(),
      getSystemStats: jest.fn(),
      recordAttenuationData: jest.fn(),
      getYeastComparison: jest.fn(),
      updateYeastAnalytics: jest.fn()
    }
  }
}));

describe('AttenuationAnalyticsService', () => {
  const service = attenuationAnalyticsService;

  const mockYeastAnalytics: AttenuationAnalytics = {
    ingredient_id: 'yeast-123',
    ingredient_name: 'Safale US-05',
    theoretical_attenuation: 75,
    improved_estimate: 76.5,
    actual_attenuation_count: 15,
    attenuation_confidence: 0.85,
    min_attenuation: 72,
    max_attenuation: 78,
    avg_attenuation: 75,
    last_updated: '2024-01-15T10:30:00Z'
  };

  const mockAllYeastAnalytics = [
    mockYeastAnalytics,
    {
      ingredient_id: 'yeast-456',
      ingredient_name: 'Wyeast 1056',
      theoretical_attenuation: 76,
      improved_estimate: 77.2,
      actual_attenuation_count: 22,
      attenuation_confidence: 0.92,
      min_attenuation: 73,
      max_attenuation: 77,
      avg_attenuation: 75,
      last_updated: '2024-01-10T14:20:00Z'
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    // Clear the service cache to ensure clean state between tests
    service.clearCache();
  });

  describe('getYeastAnalytics', () => {
    it('should fetch analytics for a specific yeast ingredient', async () => {
      const mockResponse = { data: mockYeastAnalytics };
      (ApiService.attenuationAnalytics.getYeastAnalytics as jest.Mock).mockResolvedValue(mockResponse);

      const result = await service.getYeastAnalytics('yeast-123');

      expect(ApiService.attenuationAnalytics.getYeastAnalytics).toHaveBeenCalledWith('yeast-123');
      expect(result).toEqual(mockYeastAnalytics);
    });

    it('should handle errors when fetching yeast analytics', async () => {
      const errorMessage = 'Network error';
      (ApiService.attenuationAnalytics.getYeastAnalytics as jest.Mock).mockRejectedValue(new Error(errorMessage));

      await expect(service.getYeastAnalytics('yeast-123')).rejects.toThrow('Failed to load analytics for yeast yeast-123');
      expect(ApiService.attenuationAnalytics.getYeastAnalytics).toHaveBeenCalledWith('yeast-123');
    });
  });

  describe('getAllYeastAnalytics', () => {
    it('should fetch all yeast analytics and cache the results', async () => {
      const mockResponse = { data: { yeast_analytics: mockAllYeastAnalytics } };
      (ApiService.attenuationAnalytics.getAllYeastAnalytics as jest.Mock).mockResolvedValue(mockResponse);

      const result = await service.getAllYeastAnalytics();

      expect(ApiService.attenuationAnalytics.getAllYeastAnalytics).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockAllYeastAnalytics);
    });

    it('should return cached results when cache is valid', async () => {
      const mockResponse = { data: { yeast_analytics: mockAllYeastAnalytics } };
      (ApiService.attenuationAnalytics.getAllYeastAnalytics as jest.Mock).mockResolvedValue(mockResponse);

      // Clear cache first to ensure clean state
      service.clearCache();
      
      // First call - should fetch and cache
      await service.getAllYeastAnalytics();
      
      // Second call - should use cache
      const result = await service.getAllYeastAnalytics();

      expect(ApiService.attenuationAnalytics.getAllYeastAnalytics).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockAllYeastAnalytics);
    });

    it('should bypass cache when useCache is false', async () => {
      const mockResponse = { data: { yeast_analytics: mockAllYeastAnalytics } };
      (ApiService.attenuationAnalytics.getAllYeastAnalytics as jest.Mock).mockResolvedValue(mockResponse);

      // Ensure cache is clear
      service.clearCache();
      
      // First call with caching
      await service.getAllYeastAnalytics(true);
      
      // Second call without caching - should make another API call
      await service.getAllYeastAnalytics(false);

      expect(ApiService.attenuationAnalytics.getAllYeastAnalytics).toHaveBeenCalledTimes(2);
    });

    it('should handle errors when fetching all yeast analytics', async () => {
      const errorMessage = 'API error';
      
      // Clear cache and reset mock
      service.clearCache();
      (ApiService.attenuationAnalytics.getAllYeastAnalytics as jest.Mock).mockClear();
      (ApiService.attenuationAnalytics.getAllYeastAnalytics as jest.Mock).mockRejectedValue(new Error(errorMessage));

      await expect(service.getAllYeastAnalytics()).rejects.toThrow('Failed to load yeast analytics');
      expect(ApiService.attenuationAnalytics.getAllYeastAnalytics).toHaveBeenCalledTimes(1);
    });
  });

  describe('getImprovedEstimate', () => {
    it('should fetch improved estimate for a yeast ingredient', async () => {
      const mockResponse = { data: { improved_estimate: 76.5 } };
      (ApiService.attenuationAnalytics.getImprovedEstimate as jest.Mock).mockResolvedValue(mockResponse);

      const result = await service.getImprovedEstimate('yeast-123');

      expect(ApiService.attenuationAnalytics.getImprovedEstimate).toHaveBeenCalledWith('yeast-123');
      expect(result).toBe(76.5);
    });

    it('should handle errors when fetching improved estimate', async () => {
      const errorMessage = 'Estimate error';
      (ApiService.attenuationAnalytics.getImprovedEstimate as jest.Mock).mockRejectedValue(new Error(errorMessage));

      await expect(service.getImprovedEstimate('yeast-123')).rejects.toThrow('Failed to get improved estimate for yeast yeast-123');
    });
  });

  describe('getSystemStats', () => {
    it('should fetch system statistics', async () => {
      const mockStats = {
        total_yeast_ingredients: 150,
        yeast_with_actual_data: 85,
        total_attenuation_data_points: 1200,
        high_confidence_yeast: 42,
        data_coverage_percentage: 56.7
      };
      const mockResponse = { data: mockStats };
      (ApiService.attenuationAnalytics.getSystemStats as jest.Mock).mockResolvedValue(mockResponse);

      const result = await service.getSystemStats();

      expect(ApiService.attenuationAnalytics.getSystemStats).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockStats);
    });

    it('should handle errors when fetching system stats', async () => {
      const errorMessage = 'Stats error';
      (ApiService.attenuationAnalytics.getSystemStats as jest.Mock).mockRejectedValue(new Error(errorMessage));

      await expect(service.getSystemStats()).rejects.toThrow('Failed to load system statistics');
    });
  });

  describe('utility methods', () => {
    describe('formatConfidence', () => {
      it('should format confidence as percentage', () => {
        expect(service.formatConfidence(0.85)).toBe('85%');
        expect(service.formatConfidence(0)).toBe('No data');
        expect(service.formatConfidence(undefined)).toBe('No data');
      });
    });

    describe('getConfidenceLevel', () => {
      it('should return appropriate confidence levels', () => {
        const high = service.getConfidenceLevel(0.8);
        expect(high.level).toBe('high');
        expect(high.description).toBe('High confidence in prediction');
        expect(high.color).toBe('text-green-500');

        const medium = service.getConfidenceLevel(0.5);
        expect(medium.level).toBe('medium');

        const low = service.getConfidenceLevel(0.2);
        expect(low.level).toBe('low');

        const none = service.getConfidenceLevel(0);
        expect(none.level).toBe('none');
      });
    });

    describe('formatAttenuationDifference', () => {
      it('should calculate and format attenuation differences', () => {
        const higher = service.formatAttenuationDifference(75, 77);
        expect(higher.difference).toBe(2);
        expect(higher.direction).toBe('higher');
        expect(higher.formatted).toBe('+2.0%');

        const lower = service.formatAttenuationDifference(75, 73);
        expect(lower.difference).toBe(-2);
        expect(lower.direction).toBe('lower');
        expect(lower.formatted).toBe('-2.0%');

        const same = service.formatAttenuationDifference(75, 75);
        expect(same.difference).toBe(0);
        expect(same.direction).toBe('same');

        const noData = service.formatAttenuationDifference(undefined, 75);
        expect(noData.formatted).toBe('N/A');
      });
    });

    describe('hasSignificantData', () => {
      it('should determine if analytics have significant data', () => {
        const significantData = {
          ...mockYeastAnalytics,
          actual_attenuation_count: 5,
          attenuation_confidence: 0.7
        };
        expect(service.hasSignificantData(significantData)).toBe(true);

        const insufficientData = {
          ...mockYeastAnalytics,
          actual_attenuation_count: 2,
          attenuation_confidence: 0.1
        };
        expect(service.hasSignificantData(insufficientData)).toBe(false);
      });
    });

    describe('getBestEstimate', () => {
      it('should return improved estimate when available', () => {
        const result = service.getBestEstimate(mockYeastAnalytics);
        expect(result).toBe(76.5); // improved_estimate
      });

      it('should return theoretical estimate when improved is not available', () => {
        const analyticsWithoutImproved = {
          ...mockYeastAnalytics,
          improved_estimate: undefined
        };
        const result = service.getBestEstimate(analyticsWithoutImproved);
        expect(result).toBe(75); // theoretical_attenuation
      });
    });
  });

  describe('getRecipeYeastAnalytics', () => {
    it('should fetch analytics for multiple yeast ingredients', async () => {
      const mockResponse = { data: mockYeastAnalytics };
      (ApiService.attenuationAnalytics.getYeastAnalytics as jest.Mock).mockResolvedValue(mockResponse);

      const result = await service.getRecipeYeastAnalytics(['yeast-123', 'yeast-456']);

      expect(ApiService.attenuationAnalytics.getYeastAnalytics).toHaveBeenCalledTimes(2);
      expect(result).toHaveLength(2);
    });

    it('should handle empty ingredient list', async () => {
      const result = await service.getRecipeYeastAnalytics([]);
      expect(result).toEqual([]);
    });

    it('should filter out failed requests', async () => {
      (ApiService.attenuationAnalytics.getYeastAnalytics as jest.Mock)
        .mockResolvedValueOnce({ data: mockYeastAnalytics })
        .mockRejectedValueOnce(new Error('Failed'));

      const result = await service.getRecipeYeastAnalytics(['yeast-123', 'yeast-456']);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(mockYeastAnalytics);
    });
  });

  describe('clearCache and refreshAnalytics', () => {
    it('should clear the analytics cache', async () => {
      const mockResponse = { data: { yeast_analytics: mockAllYeastAnalytics } };
      (ApiService.attenuationAnalytics.getAllYeastAnalytics as jest.Mock).mockResolvedValue(mockResponse);
      
      // Populate cache
      await service.getAllYeastAnalytics();
      
      // Clear cache
      service.clearCache();
      
      // Next call should fetch from API again
      await service.getAllYeastAnalytics();
      
      expect(ApiService.attenuationAnalytics.getAllYeastAnalytics).toHaveBeenCalledTimes(2);
    });

    it('should refresh analytics by clearing cache and fetching new data', async () => {
      const mockResponse = { data: { yeast_analytics: mockAllYeastAnalytics } };
      (ApiService.attenuationAnalytics.getAllYeastAnalytics as jest.Mock).mockResolvedValue(mockResponse);

      const result = await service.refreshAnalytics();

      expect(result).toEqual(mockAllYeastAnalytics);
      expect(ApiService.attenuationAnalytics.getAllYeastAnalytics).toHaveBeenCalledTimes(1);
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle empty analytics arrays', async () => {
      const mockResponse = { data: { yeast_analytics: [] } };
      (ApiService.attenuationAnalytics.getAllYeastAnalytics as jest.Mock).mockResolvedValue(mockResponse);

      const result = await service.getAllYeastAnalytics();

      expect(result).toEqual([]);
    });

    it('should handle invalid ingredient IDs', async () => {
      (ApiService.attenuationAnalytics.getYeastAnalytics as jest.Mock).mockRejectedValue(
        new Error('Ingredient not found')
      );

      await expect(service.getYeastAnalytics('invalid-id')).rejects.toThrow(
        'Failed to load analytics for yeast invalid-id'
      );
    });

    it('should handle malformed API responses', async () => {
      const malformedResponse = { data: null };
      (ApiService.attenuationAnalytics.getAllYeastAnalytics as jest.Mock).mockResolvedValue(malformedResponse);

      await expect(service.getAllYeastAnalytics()).rejects.toThrow();
    });
  });
});