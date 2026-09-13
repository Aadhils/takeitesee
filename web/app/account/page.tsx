import AuthenticatedAccount from '../../components/account/AuthenticatedAccount';
import LocalizedAccountShell from '../../components/account/LocalizedAccountShell';

export default function AccountPage() {
  return <LocalizedAccountShell active="/account"><AuthenticatedAccount /></LocalizedAccountShell>;
}
