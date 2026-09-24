import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom';

function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe('ProgressBar', () => {
  test('renders progress stage and percentage', async () => {
    const { default: ProgressBar } = await import('../src/components/ProgressBar');
    renderWithRouter(<ProgressBar progress={50} stage="Scanning..." />);
    expect(screen.getByText('Scanning...')).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
  });

  test('renders detail text when provided', async () => {
    const { default: ProgressBar } = await import('../src/components/ProgressBar');
    renderWithRouter(<ProgressBar progress={10} stage="Starting" detail="Please wait" />);
    expect(screen.getByText('Please wait')).toBeInTheDocument();
  });
});

describe('Helpers', () => {
  test('getRiskColor returns correct colors', async () => {
    const { getRiskColor, getRiskLabel, getRiskBadge } = await import('../src/utils/helpers');
    expect(getRiskColor(40)).toBe('text-red-600');
    expect(getRiskColor(20)).toBe('text-yellow-600');
    expect(getRiskColor(5)).toBe('text-green-600');
    expect(getRiskLabel(40)).toBe('High Risk');
    expect(getRiskLabel(20)).toBe('Moderate Risk');
    expect(getRiskLabel(5)).toBe('Low Risk');
    expect(getRiskBadge(40)).toBe('badge-red');
    expect(getRiskBadge(5)).toBe('badge-green');
  });

  test('applyFixesToText replaces original with fix', async () => {
    const { applyFixesToText } = await import('../src/utils/helpers');
    const original = 'Hello world this is a test';
    const fixes = [{
      matchId: '1',
      originalText: 'Hello world',
      fixedText: 'Greetings earth',
      suggestionIndex: 0
    }];
    const result = applyFixesToText(original, fixes);
    expect(result).toBe('Greetings earth this is a test');
  });

  test('applyFixesToText returns original when no fixes', async () => {
    const { applyFixesToText } = await import('../src/utils/helpers');
    const original = 'Some text';
    expect(applyFixesToText(original, [])).toBe(original);
  });
});