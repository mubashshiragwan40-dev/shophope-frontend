// components/field-error.tsx

interface FieldErrorProps {
  message?: string;
  id?: string;
}

export default function FieldError({ message, id }: FieldErrorProps) {
  if (!message) return null;
  return (
    <p id={id} className="mt-1 text-sm text-red-600" role="alert">
      {message}
    </p>
  );
}
