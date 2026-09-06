alter type public.installation_assignment_status
  add value if not exists 'DRAFT'
  before 'ASSIGNED';
