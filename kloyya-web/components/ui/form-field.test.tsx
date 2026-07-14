import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { expectNoA11yViolations } from '@/test/a11y';
import { FormField } from './form-field';
import { Input } from './input';

describe('FormField', () => {
  it('associates the label with the control', () => {
    render(
      <FormField label="Work email">
        {(field) => <Input {...field} type="email" />}
      </FormField>,
    );

    // getByLabelText only resolves through a real label/for association.
    expect(screen.getByLabelText('Work email')).toBeInTheDocument();
  });

  it('describes the control with its helper text', () => {
    render(
      <FormField label="Company" description="Used to tailor your briefing.">
        {(field) => <Input {...field} />}
      </FormField>,
    );

    expect(screen.getByLabelText('Company')).toHaveAccessibleDescription(
      'Used to tailor your briefing.',
    );
  });

  describe('when invalid', () => {
    it('sets aria-invalid and announces the error via an alert', () => {
      render(
        <FormField label="Work email" error="Enter a valid email address.">
          {(field) => <Input {...field} isInvalid />}
        </FormField>,
      );

      expect(screen.getByLabelText('Work email')).toHaveAttribute(
        'aria-invalid',
        'true',
      );
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Enter a valid email address.',
      );
    });

    it('describes the control with both the hint and the error, hint first', () => {
      render(
        <FormField
          label="Password"
          description="At least 12 characters."
          error="Too short."
        >
          {(field) => <Input {...field} type="password" isInvalid />}
        </FormField>,
      );

      // Order matters: the user should hear what is expected before what failed.
      expect(screen.getByLabelText('Password')).toHaveAccessibleDescription(
        'At least 12 characters. Too short.',
      );
    });

    it('has no accessibility violations', async () => {
      const { container } = render(
        <FormField label="Work email" error="Enter a valid email address.">
          {(field) => <Input {...field} isInvalid />}
        </FormField>,
      );
      await expectNoA11yViolations(container);
    });
  });

  it('keeps the live region mounted before an error exists', () => {
    // A role="alert" inserted at the same moment as its text is announced
    // inconsistently. It must already be in the DOM, empty.
    render(<FormField label="Name">{(field) => <Input {...field} />}</FormField>);

    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(alert).toBeEmptyDOMElement();
  });

  it('marks required fields for assistive tech, not only with an asterisk', () => {
    render(
      <FormField label="Work email" isRequired>
        {(field) => <Input {...field} />}
      </FormField>,
    );

    expect(screen.getByLabelText(/Work email/)).toHaveAttribute(
      'aria-required',
      'true',
    );
  });

  it('keeps the label accessible when visually hidden', () => {
    render(
      <FormField label="Search" hideLabel>
        {(field) => <Input {...field} />}
      </FormField>,
    );

    expect(screen.getByLabelText('Search')).toBeInTheDocument();
  });
});
