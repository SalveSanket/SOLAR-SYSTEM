pipeline {
    agent any

    tools {
        nodejs 'nodejs-22-6-0'
    }

    environment {
        MONGO_URI = "mongodb+srv://supercluster.d83jj.mongodb.net/superData"
    }

    options {
        disableConcurrentBuilds()
        disableResume()
    }

    stages {
        stage('Checkout Code') {
            steps {
                echo '📥 Checking out code....'
                checkout scm
            }
        }

        stage('VM Node Version') {
            steps {
                sh '''
                    node -v
                    npm -v
                '''
            }
        }

        stage('Install Dependencies') {
            options {
                timestamps()
            }
            steps {
                echo '🔧 Installing dependencies....'
                sh 'npm install --no-audit'
                sh 'npm install --include=dev --no-audit'
                echo '🔧 Dependencies installed successfully!'
            }
        }

        stage('Dependency Check') {
            options {
                timestamps()
            }
            parallel {
                stage('NPM Dependency Audit') {
                    steps {
                        echo '🔍 Running npm audit....'
                        sh 'npm audit --audit-level=critical'
                        echo '🔍 Audit completed successfully!'
                    }
                }

                stage('OWASP Dependency Check') {
                    steps {
                        echo '🛡️ Running OWASP Dependency Check...'

                        dependencyCheck additionalArguments: '''
                            --scan ./
                            --out ./ 
                            --format ALL 
                            --prettyPrint
                            --disableYarnAudit
                        ''', odcInstallation: 'OWASP-DepCheck'

                        
                        echo '📦 Archiving HTML report...'
                        publishHTML([allowMissing: true, alwaysLinkToLastBuild: true, icon: '', keepAll: true, reportDir: './', reportFiles: 'dependency-check-jenkins.html', reportName: 'dependency-check-HTML Report', reportTitles: '', useWrapperFileDirectly: true])
                    }
                }
            }
        }
        
        stage('unit test') {
            options {
                timestamps()
                retry(2)
            }
            steps {
                withCredentials([usernamePassword(credentialsId: 'mongo-db-credentials', passwordVariable: 'MONGO_PASSWORD', usernameVariable: 'MONGO_USERNAME')]) {
                    echo '🧪 Running unit tests....'
                    sh 'npm test'
                    echo '🧪 Unit tests completed successfully!'
                }
                junit allowEmptyResults: true, stdioRetention: '',testResults: 'test-results.xml'
            }
        }

        stage('code coverage') {
            options {
                timestamps()
                retry(2)
            }
            steps {
                withCredentials([usernamePassword(credentialsId: 'mongo-db-credentials', passwordVariable: 'MONGO_PASSWORD', usernameVariable: 'MONGO_USERNAME')]) {
                    catchError(buildResult: 'SUCCESS', message: 'Oops! it will be fixed in feature releases', stageResult: 'UNSTABLE')
                    echo '🧪 Running unit tests....'
                    sh 'npm run coverage'
                    echo '🧪 Unit tests completed successfully!'
                }

                publishHTML([allowMissing: true, alwaysLinkToLastBuild: true, keepAll: true, reportDir: 'coverage/lcov-result', reportFiles: 'index.html', reportName: 'Code Coverage Report', reportTitles: '', useWrapperFileDirectly: true])
            }
        }
    }

    post {
        success {
            echo '✅ Build completed successfully!'
        }
        failure {
            echo '❌ Build failed. Check the logs.'
        }
    }
}