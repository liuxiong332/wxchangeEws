/*
 * this file is used to serialize the ExchangeMessage object to RFC822 test
 */
var EXPORTED_SYMBOLS = ["exchangeToRFC822Mail"];

function mailboxToStr(mailbox) {
  return mailbox.name + '<' + mailbox.emailAddress + '>';
}

function exchangeToRFC822Mail(msg) {
  var mailStr = '';
  if(msg.subject)
    mailStr += 'Subject: ' + msg.subject + '\r\n';
  if(msg.mimeContent)
    mailStr += 'Content-Type: ' + msg.mimeContent + '\r\n';
  if(msg.itemId)
    mailStr += 'Message-ID: ' + msg.itemId + '\r\n';
  if(msg.inReplyTo)
    mailStr += 'In-Reply-To: ' + msg.inReplyTo + '\r\n';
  if(msg.dateTimeCreated)
    mailStr += 'Date: ' + msg.dateTimeCreated + '\r\n';
  if(msg.from) {
    mailStr += 'From: ' + mailboxToStr(msg.from) + '\r\n'
  }
  if(msg.toRecipients) {
    mailStr += 'To: ' + mailboxToStr(msg.toRecipients) + '\r\n';
  }

  if(msg.body)
    mailStr += '\r\n' + msg.body + '\r\n';
  return mailStr;
}
