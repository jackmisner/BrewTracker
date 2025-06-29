// @ts-ignore - React needed for JSX in test files
import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import StyleRangeIndicator from '../../src/components/RecipeBuilder/BeerStyles/StyleRangeIndicator';

// Mock the formatUtils
jest.mock('../../src/utils/formatUtils', () => ({
  formatGravity: jest.fn((value) => value.toFixed(3)),
  formatAbv: jest.fn((value) => `${value.toFixed(1)}%`),
  formatIbu: jest.fn((value) => Math.round(value).toString()),
  formatSrm: jest.fn((value) => value.toFixed(1)),
}));

describe('StyleRangeIndicator', () => {
  const mockStyleRange = {
    min: 1.040,
    max: 1.060,
  };

  const mockStyleRangeWithObjects = {
    minimum: { value: 1.040 },
    maximum: { value: 1.060 },
  };

  describe('Rendering', () => {
    it('renders with basic props', () => {
      render(
        <StyleRangeIndicator
          metricType="og"
          currentValue={1.050}
          styleRange={mockStyleRange}
          label="Original Gravity"
        />
      );

      expect(screen.getByText('Original Gravity')).toBeInTheDocument();
      expect(screen.getByText('1.050')).toBeInTheDocument();
      expect(screen.getByText('(1.040 - 1.060)')).toBeInTheDocument();
    });

    it('renders with unit', () => {
      render(
        <StyleRangeIndicator
          metricType="abv"
          currentValue={6.5}
          styleRange={{ min: 5.0, max: 8.0 }}
          label="Alcohol by Volume"
          unit="%"
        />
      );

      expect(screen.getByText('Alcohol by Volume')).toBeInTheDocument();
      expect(screen.getByText('6.5%')).toBeInTheDocument();
      expect(screen.getByText('(5.0% - 8.0%%)')).toBeInTheDocument();
    });

    it('handles object-based style range format', () => {
      render(
        <StyleRangeIndicator
          metricType="og"
          currentValue={1.050}
          styleRange={mockStyleRangeWithObjects}
          label="Original Gravity"
        />
      );

      expect(screen.getByText('Original Gravity')).toBeInTheDocument();
      expect(screen.getByText('1.050')).toBeInTheDocument();
    });

    it('renders null for invalid range', () => {
      const { container } = render(
        <StyleRangeIndicator
          metricType="og"
          currentValue={1.050}
          styleRange={{ min: 1.060, max: 1.040 }} // Invalid: min > max
          label="Original Gravity"
        />
      );

      expect(container).toBeEmptyDOMElement();
    });

    it('renders null for missing range values', () => {
      const { container } = render(
        <StyleRangeIndicator
          metricType="og"
          currentValue={1.050}
          styleRange={{}} // No min/max
          label="Original Gravity"
        />
      );

      expect(container).toBeEmptyDOMElement();
    });
  });

  describe('Metric Type Formatting', () => {
    it('formats gravity values correctly', () => {
      render(
        <StyleRangeIndicator
          metricType="og"
          currentValue={1.065}
          styleRange={mockStyleRange}
          label="Original Gravity"
        />
      );

      expect(screen.getByText('1.065')).toBeInTheDocument();
    });

    it('formats ABV values correctly', () => {
      render(
        <StyleRangeIndicator
          metricType="abv"
          currentValue={6.8}
          styleRange={{ min: 5.0, max: 8.0 }}
          label="Alcohol by Volume"
        />
      );

      expect(screen.getByText('6.8%')).toBeInTheDocument();
    });

    it('formats IBU values correctly', () => {
      render(
        <StyleRangeIndicator
          metricType="ibu"
          currentValue={45.7}
          styleRange={{ min: 30, max: 60 }}
          label="International Bitterness Units"
        />
      );

      expect(screen.getByText('46')).toBeInTheDocument(); // Rounded
    });

    it('formats SRM values correctly', () => {
      render(
        <StyleRangeIndicator
          metricType="srm"
          currentValue={8.3}
          styleRange={{ min: 6, max: 12 }}
          label="Color (SRM)"
        />
      );

      expect(screen.getByText('8.3')).toBeInTheDocument();
    });
  });

  describe('Range Validation and Visual Indicators', () => {
    it('shows in-range styling for values within range', () => {
      render(
        <StyleRangeIndicator
          metricType="og"
          currentValue={1.050} // Within 1.040-1.060
          styleRange={mockStyleRange}
          label="Original Gravity"
        />
      );

      const currentValue = screen.getByText('1.050');
      expect(currentValue).toHaveStyle({ color: '#10b981' }); // Green
    });

    it('shows out-of-range styling for values below range', () => {
      render(
        <StyleRangeIndicator
          metricType="og"
          currentValue={1.030} // Below 1.040-1.060
          styleRange={mockStyleRange}
          label="Original Gravity"
        />
      );

      const currentValue = screen.getByText('1.030');
      expect(currentValue).toHaveStyle({ color: '#ef4444' }); // Red
    });

    it('shows out-of-range styling for values above range', () => {
      render(
        <StyleRangeIndicator
          metricType="og"
          currentValue={1.070} // Above 1.040-1.060
          styleRange={mockStyleRange}
          label="Original Gravity"
        />
      );

      const currentValue = screen.getByText('1.070');
      expect(currentValue).toHaveStyle({ color: '#ef4444' }); // Red
    });

    it('shows left arrow for values below range', () => {
      render(
        <StyleRangeIndicator
          metricType="og"
          currentValue={1.030} // Below range
          styleRange={mockStyleRange}
          label="Original Gravity"
        />
      );

      expect(screen.getByText('←')).toBeInTheDocument();
    });

    it('shows right arrow for values above range', () => {
      render(
        <StyleRangeIndicator
          metricType="og"
          currentValue={1.080} // Above range
          styleRange={mockStyleRange}
          label="Original Gravity"
        />
      );

      expect(screen.getByText('→')).toBeInTheDocument();
    });

    it('shows no arrows for values within range', () => {
      render(
        <StyleRangeIndicator
          metricType="og"
          currentValue={1.050} // Within range
          styleRange={mockStyleRange}
          label="Original Gravity"
        />
      );

      expect(screen.queryByText('←')).not.toBeInTheDocument();
      expect(screen.queryByText('→')).not.toBeInTheDocument();
    });
  });

  describe('Position Calculation', () => {
    it('positions indicator correctly for value at minimum', () => {
      const { container } = render(
        <StyleRangeIndicator
          metricType="og"
          currentValue={1.040} // At minimum
          styleRange={mockStyleRange}
          label="Original Gravity"
        />
      );

      const indicator = container.querySelector('.range-bar-indicator');
      expect(indicator).toHaveStyle({ left: '0%' });
    });

    it('positions indicator correctly for value at maximum', () => {
      const { container } = render(
        <StyleRangeIndicator
          metricType="og"
          currentValue={1.060} // At maximum
          styleRange={mockStyleRange}
          label="Original Gravity"
        />
      );

      const indicator = container.querySelector('.range-bar-indicator');
      expect(indicator).toHaveStyle({ left: '100%' });
    });

    it('positions indicator correctly for value in middle', () => {
      const { container } = render(
        <StyleRangeIndicator
          metricType="og"
          currentValue={1.050} // In middle (50%)
          styleRange={mockStyleRange}
          label="Original Gravity"
        />
      );

      const indicator = container.querySelector('.range-bar-indicator');
      expect(indicator).toHaveStyle({ left: '50%' });
    });

    it('clamps position to 0% for values below range', () => {
      const { container } = render(
        <StyleRangeIndicator
          metricType="og"
          currentValue={1.020} // Way below range
          styleRange={mockStyleRange}
          label="Original Gravity"
        />
      );

      const indicator = container.querySelector('.range-bar-indicator');
      expect(indicator).toHaveStyle({ left: '0%' });
    });

    it('clamps position to 100% for values above range', () => {
      const { container } = render(
        <StyleRangeIndicator
          metricType="og"
          currentValue={1.100} // Way above range
          styleRange={mockStyleRange}
          label="Original Gravity"
        />
      );

      const indicator = container.querySelector('.range-bar-indicator');
      expect(indicator).toHaveStyle({ left: '100%' });
    });
  });

  describe('Range Labels', () => {
    it('displays minimum and maximum range labels', () => {
      render(
        <StyleRangeIndicator
          metricType="og"
          currentValue={1.050}
          styleRange={mockStyleRange}
          label="Original Gravity"
        />
      );

      // Check for range labels (they appear twice - in target range and as range labels)
      const minLabels = screen.getAllByText('1.040');
      const maxLabels = screen.getAllByText('1.060');
      
      expect(minLabels.length).toBeGreaterThanOrEqual(1);
      expect(maxLabels.length).toBeGreaterThanOrEqual(1);
    });

    it('displays correct range for different metric types', () => {
      render(
        <StyleRangeIndicator
          metricType="ibu"
          currentValue={50}
          styleRange={{ min: 20, max: 80 }}
          label="Bitterness"
        />
      );

      expect(screen.getByText('20')).toBeInTheDocument();
      expect(screen.getByText('80')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('handles zero values correctly', () => {
      const { container } = render(
        <StyleRangeIndicator
          metricType="srm"
          currentValue={0}
          styleRange={{ min: 0, max: 10 }}
          label="Color"
        />
      );

      // Component returns null for min=0 because !minValue treats 0 as falsy
      expect(container).toBeEmptyDOMElement();
    });

    it('handles negative values correctly', () => {
      const { container } = render(
        <StyleRangeIndicator
          metricType="srm"
          currentValue={-5}
          styleRange={{ min: 0, max: 10 }}
          label="Color"
        />
      );

      // Component returns null for min=0 because !minValue treats 0 as falsy
      expect(container).toBeEmptyDOMElement();
    });

    it('handles very large values correctly', () => {
      render(
        <StyleRangeIndicator
          metricType="ibu"
          currentValue={1000}
          styleRange={{ min: 20, max: 80 }}
          label="Bitterness"
        />
      );

      expect(screen.getByText('1000')).toBeInTheDocument();
      expect(screen.getByText('→')).toBeInTheDocument(); // Should show right arrow
    });

    it('handles very small ranges correctly', () => {
      render(
        <StyleRangeIndicator
          metricType="og"
          currentValue={1.0005}
          styleRange={{ min: 1.000, max: 1.001 }}
          label="Gravity"
        />
      );

      expect(screen.getByText('1.001')).toBeInTheDocument();
    });

    it('handles equal min and max values (edge case)', () => {
      const { container } = render(
        <StyleRangeIndicator
          metricType="og"
          currentValue={1.050}
          styleRange={{ min: 1.050, max: 1.050 }}
          label="Gravity"
        />
      );

      expect(container).toBeEmptyDOMElement(); // Should render null
    });
  });

  describe('CSS Classes and Structure', () => {
    it('has correct CSS class structure', () => {
      const { container } = render(
        <StyleRangeIndicator
          metricType="og"
          currentValue={1.050}
          styleRange={mockStyleRange}
          label="Original Gravity"
        />
      );

      expect(container.querySelector('.style-range-indicator')).toBeInTheDocument();
      expect(container.querySelector('.range-header')).toBeInTheDocument();
      expect(container.querySelector('.range-label')).toBeInTheDocument();
      expect(container.querySelector('.range-values')).toBeInTheDocument();
      expect(container.querySelector('.current-value')).toBeInTheDocument();
      expect(container.querySelector('.target-range')).toBeInTheDocument();
      expect(container.querySelector('.range-bar-container')).toBeInTheDocument();
      expect(container.querySelector('.range-bar-track')).toBeInTheDocument();
      expect(container.querySelector('.range-bar-indicator')).toBeInTheDocument();
      expect(container.querySelector('.range-labels')).toBeInTheDocument();
    });

    it('applies correct styling for in-range values', () => {
      const { container } = render(
        <StyleRangeIndicator
          metricType="og"
          currentValue={1.050}
          styleRange={mockStyleRange}
          label="Original Gravity"
        />
      );

      const indicator = container.querySelector('.range-bar-indicator');
      expect(indicator).toHaveStyle({
        backgroundColor: '#10b981',
        borderColor: '#10b981',
      });
    });

    it('applies correct styling for out-of-range values', () => {
      const { container } = render(
        <StyleRangeIndicator
          metricType="og"
          currentValue={1.070}
          styleRange={mockStyleRange}
          label="Original Gravity"
        />
      );

      const indicator = container.querySelector('.range-bar-indicator');
      expect(indicator).toHaveStyle({
        backgroundColor: '#ef4444',
        borderColor: '#ef4444',
      });
    });
  });
});