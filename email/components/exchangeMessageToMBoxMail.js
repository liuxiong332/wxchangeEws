/*
 * this file is used to serialize the ExchangeMessage object to RFC822 test
 */

function exchangeMessageToMBoxMail(exchangeMessage) {
  var mailStr = '';
  if(exchangeMessage.subject)
    mailStr += 'Subject: ' + exchangeMessage.subject + '\r\n';
  if(exchangeMessage.mimeContent)
    mailStr += 'Content-Type: ' + exchangeMessage.mimeContent + '\r\n';
  if(exchangeMessage.itemId)
    mailStr += 'Message-ID: ' + exchangeMessage.itemId + '\r\n';
  if(exchangeMessage.inReplyTo)
    mailStr += 'In-Reply-To: ' + exchangeMessage.inReplyTo + '\r\n';
  if(exchangeMessage.dateTimeCreated)
    mailStr += 'Date: ' + exchangeMessage.dateTimeCreated + '\r\n';

  if(exchangeMessage.body)
    mailStr += '\r\n' + exchangeMessage.body + '\r\n';
}
